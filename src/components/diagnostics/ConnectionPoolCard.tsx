"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatabasePoolStatsResponse } from "@/lib/api/types";
import { getDatabasePoolStats } from "@/lib/api/admin-operations";
import { RefreshCw, Server, AlertCircle } from "lucide-react";

export function ConnectionPoolCard() {
  const [data, setData] = useState<DatabasePoolStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  const loadStats = useCallback(async (isInitial: boolean) => {
    if (!isInitial && inFlight.current) return;
    inFlight.current = true;
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await getDatabasePoolStats();
      if (!isMounted.current) return;
      setData(res);
      setError(null);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load pool statistics");
    } finally {
      if (isMounted.current) {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    loadStats(true);
    return () => {
      isMounted.current = false;
    };
  }, [loadStats]);

  const pool = data?.connection_pool;
  const utilization = pool?.utilization_percent ?? 0;

  const getBarColor = (pct: number) => {
    if (pct >= 85) return "bg-red-500";
    if (pct >= 60) return "bg-amber-500";
    return "bg-green-500";
  };

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-semibold">Connection Pool Statistics</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadStats(false)}
            disabled={loading || refreshing}
            className="h-8 w-8 p-0"
            title="Refresh pool statistics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>
          SQLAlchemy connection pool metrics, overflow status, and real-time utilization.
          {data?.timestamp ? (
            <span className="ml-1 text-muted-foreground/80">
              (Updated: {new Date(data.timestamp).toLocaleTimeString()})
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Inspecting database connection pool...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Pool query failed:</span>
            </div>
            <p className="mt-1">{error}</p>
          </div>
        ) : pool ? (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Pool Utilization</span>
                <span className="font-semibold tabular-nums">{utilization.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(utilization)}`}
                  style={{ width: `${Math.min(100, Math.max(0, utilization))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Pool Size
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {pool.pool_size}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Available
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-green-600">
                  {pool.available}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Checked Out
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {pool.checked_out}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Checked In
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                  {pool.checked_in}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Overflow
                </p>
                <p className={`mt-0.5 text-sm font-semibold tabular-nums ${pool.overflow > 0 ? "text-amber-600" : "text-foreground"}`}>
                  {pool.overflow}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Invalid
                </p>
                <p className={`mt-0.5 text-sm font-semibold tabular-nums ${pool.invalid > 0 ? "text-red-600" : "text-foreground"}`}>
                  {pool.invalid}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
