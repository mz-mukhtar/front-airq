"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatabaseHealthResponse } from "@/lib/api/types";
import { getDatabaseHealth } from "@/lib/api/admin-operations";
import { RefreshCw, Database, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export function DatabaseHealthCard() {
  const [data, setData] = useState<DatabaseHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  const loadHealth = useCallback(async (isInitial: boolean) => {
    if (!isInitial && inFlight.current) return;
    inFlight.current = true;
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await getDatabaseHealth();
      if (!isMounted.current) return;
      setData(res);
      setError(null);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : "Database health check failed");
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
    loadHealth(true);
    return () => {
      isMounted.current = false;
    };
  }, [loadHealth]);

  const getStatusBadge = () => {
    if (error) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/20">
          <XCircle className="h-3.5 w-3.5 text-red-600" />
          Database status unavailable
        </span>
      );
    }
    if (!data) return null;

    const statusStr = (data.status || "").toLowerCase();
    if (statusStr === "healthy") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 ring-1 ring-inset ring-green-600/20">
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          Healthy
        </span>
      );
    }
    if (statusStr === "degraded") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          Degraded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/20">
        <XCircle className="h-3.5 w-3.5 text-red-600" />
        Unhealthy
      </span>
    );
  };

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-semibold">Database Health</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadHealth(false)}
              disabled={loading || refreshing}
              className="h-8 w-8 p-0"
              title="Refresh database health"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Real-time PostgreSQL engine status, active connection count, and server metadata.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Checking database connectivity & engine status...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p className="font-semibold">Database check encountered an error:</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Version
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground" title={data.database_info.version || "Unknown"}>
                  {data.database_info.version || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Server Timezone
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {data.database_info.timezone || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Database Size
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {data.database_info.size || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Active Connections
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {data.database_info.active_connections !== undefined
                    ? data.database_info.active_connections
                    : "—"}
                </p>
              </div>
            </div>

            {data.errors && data.errors.length > 0 && (
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20">
                <p className="font-semibold">Partial probe warnings:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {data.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
