"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PerformanceEndpointMetric, PerformanceSingleEndpointMetric } from "@/lib/api/types";
import { getPerformanceStats } from "@/lib/api/admin-operations";
import { RefreshCw, Activity, ArrowUpDown, AlertCircle } from "lucide-react";

type SortField = "endpoint" | "total_requests" | "avg_response_time_ms" | "max_response_time_ms";
type SortOrder = "asc" | "desc";

export function PerformanceStatsTable() {
  const [dataMap, setDataMap] = useState<Record<string, PerformanceEndpointMetric>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("avg_response_time_ms");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  const loadStats = useCallback(async (isInitial: boolean) => {
    if (!isInitial && inFlight.current) return;
    inFlight.current = true;
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await getPerformanceStats();
      if (!isMounted.current) return;

      const raw = res.performance_stats;
      if (raw && typeof raw === "object" && "endpoint" in raw) {
        // Single metric returned
        const single = raw as PerformanceSingleEndpointMetric;
        setDataMap({ [single.endpoint]: single });
      } else if (raw && typeof raw === "object") {
        setDataMap(raw as Record<string, PerformanceEndpointMetric>);
      } else {
        setDataMap({});
      }
      setError(null);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load performance statistics");
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

  const rows = useMemo(() => {
    const entries = Object.entries(dataMap).map(([endpoint, metric]) => ({
      endpoint,
      total_requests: metric.total_requests ?? 0,
      avg_response_time_ms: metric.avg_response_time_ms ?? 0,
      min_response_time_ms: metric.min_response_time_ms ?? 0,
      max_response_time_ms: metric.max_response_time_ms ?? 0,
      p95_response_time_ms: metric.p95_response_time_ms,
      p99_response_time_ms: metric.p99_response_time_ms,
    }));

    return entries.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
  }, [dataMap, sortField, sortOrder]);

  const hasP95OrP99 = useMemo(() => {
    return rows.some((r) => r.p95_response_time_ms !== undefined || r.p99_response_time_ms !== undefined);
  }, [rows]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-semibold">API Performance Statistics</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadStats(false)}
            disabled={loading || refreshing}
            className="h-8 w-8 p-0"
            title="Refresh performance statistics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>
          Request latency and throughput metrics tracked by the backend performance monitoring middleware.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-[11px] text-muted-foreground">
          Note: Performance metrics are collected per application process and may not represent all workers.
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Aggregating endpoint performance stats...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Performance query failed:</span>
            </div>
            <p className="mt-1">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No performance metrics recorded yet. Send requests to populate stats.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("endpoint")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Endpoint
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("total_requests")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Total Requests
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("avg_response_time_ms")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Avg (ms)
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">Min (ms)</th>
                  <th className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("max_response_time_ms")}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      Max (ms)
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  {hasP95OrP99 && (
                    <>
                      <th className="px-3 py-2.5 text-right">P95 (ms)</th>
                      <th className="px-3 py-2.5 text-right">P99 (ms)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.endpoint} className="hover:bg-muted/30">
                    <td className="max-w-[280px] truncate px-3 py-2 font-mono text-[11px] text-foreground" title={row.endpoint}>
                      {row.endpoint}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                      {row.total_requests.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {row.avg_response_time_ms.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.min_response_time_ms.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                      {row.max_response_time_ms.toFixed(2)}
                    </td>
                    {hasP95OrP99 && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {row.p95_response_time_ms !== undefined ? row.p95_response_time_ms.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {row.p99_response_time_ms !== undefined ? row.p99_response_time_ms.toFixed(2) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
