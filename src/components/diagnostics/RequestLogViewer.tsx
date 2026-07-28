"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequestLog, RequestLogsParams } from "@/lib/api/types";
import { getRequestLogs } from "@/lib/api/admin-operations";
import { RequestLogDetailModal } from "./RequestLogDetailModal";
import { RefreshCw, FileText, AlertCircle, Filter, ChevronLeft, ChevronRight } from "lucide-react";

const HTTP_METHODS = ["", "GET", "POST", "PUT", "PATCH", "DELETE"];
const LIMIT_OPTIONS = [25, 50, 100, 250, 500];

export function RequestLogViewer() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [method, setMethod] = useState<string>("");
  const [path, setPath] = useState<string>("");
  const [statusCode, setStatusCode] = useState<string>("");
  const [errorsOnly, setErrorsOnly] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(100);
  const [offset, setOffset] = useState<number>(0);
  // Identity filters, set by pivoting from a row rather than typed.
  const [deviceId, setDeviceId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  // The row whose detail modal is open (null = closed).
  const [selected, setSelected] = useState<RequestLog | null>(null);

  const isMounted = useRef(true);
  const inFlight = useRef(false);

  const loadLogs = useCallback(async (isInitial: boolean, currentOffset: number) => {
    if (!isInitial && inFlight.current) return;
    inFlight.current = true;
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    const params: RequestLogsParams = {
      limit,
      offset: currentOffset,
    };
    if (method) params.method = method;
    if (path.trim()) params.path = path.trim();
    if (statusCode.trim() && !isNaN(Number(statusCode))) {
      params.status_code = Number(statusCode);
    }
    if (errorsOnly) params.errors_only = true;
    if (deviceId) params.device_id = deviceId;
    if (userEmail) params.user_email = userEmail;

    try {
      const res = await getRequestLogs(params);
      if (!isMounted.current) return;
      setLogs(res || []);
      setError(null);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load request logs");
    } finally {
      if (isMounted.current) {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [method, path, statusCode, errorsOnly, limit, deviceId, userEmail]);

  useEffect(() => {
    isMounted.current = true;
    loadLogs(true, offset);
    return () => {
      isMounted.current = false;
    };
  }, [loadLogs, offset]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    loadLogs(false, 0);
  };

  const handleResetFilters = () => {
    setMethod("");
    setPath("");
    setStatusCode("");
    setErrorsOnly(false);
    setDeviceId("");
    setUserEmail("");
    setOffset(0);
    // Trigger reload immediately with defaults
    setTimeout(() => {
      loadLogs(false, 0);
    }, 0);
  };

  /**
   * Jump from an open request to everything like it. The effect on
   * [deviceId, userEmail, path] reloads, so this only sets state.
   */
  const handlePivot = (filter: { path?: string; device_id?: string; user_email?: string }) => {
    setOffset(0);
    setDeviceId(filter.device_id ?? "");
    setUserEmail(filter.user_email ?? "");
    if (filter.path !== undefined) setPath(filter.path);
  };

  const getStatusBadge = (code: number) => {
    if (code >= 500) {
      return <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800">{code}</span>;
    }
    if (code >= 400) {
      return <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">{code}</span>;
    }
    if (code >= 300) {
      return <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-800">{code}</span>;
    }
    return <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">{code}</span>;
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null || ms === undefined) return "—";
    return `${ms.toFixed(1)} ms`;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-semibold">Request Logs</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadLogs(false, offset)}
            disabled={loading || refreshing}
            className="h-8 w-8 p-0"
            title="Refresh request logs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>
          Recorded API requests stored in the request_logs table (newest first). Filter by method, prefix path, or status code.
          <span className="ml-1 text-muted-foreground/80">Click any row for the full record.</span>
          <span className="ml-1 text-muted-foreground/80">Kept for 7 days, then deleted automatically.</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Form */}
        <form onSubmit={handleApplyFilters} className="rounded-lg border bg-muted/30 p-3 text-xs space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter Request Logs</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
            <div>
              <label htmlFor="log-method" className="block text-[11px] font-medium text-muted-foreground mb-1">
                HTTP Method
              </label>
              <select
                id="log-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Methods</option>
                {HTTP_METHODS.slice(1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="log-path" className="block text-[11px] font-medium text-muted-foreground mb-1">
                Path (Prefix Match)
              </label>
              <input
                id="log-path"
                type="text"
                placeholder="e.g. /api/v1/sensors"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="log-status" className="block text-[11px] font-medium text-muted-foreground mb-1">
                Status Code
              </label>
              <input
                id="log-status"
                type="number"
                placeholder="e.g. 500 or 404"
                value={statusCode}
                onChange={(e) => setStatusCode(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="log-limit" className="block text-[11px] font-medium text-muted-foreground mb-1">
                Page Size
              </label>
              <select
                id="log-limit"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="w-full rounded border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {LIMIT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} rows
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 pt-4 sm:pt-0">
                <input
                  type="checkbox"
                  id="log-errors-only"
                  checked={errorsOnly}
                  onChange={(e) => setErrorsOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                />
                <label htmlFor="log-errors-only" className="cursor-pointer select-none font-medium text-foreground">
                  Errors Only (≥400)
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              disabled={loading || refreshing}
              className="h-7 text-xs"
            >
              Reset
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || refreshing}
              className="h-7 bg-[#016FC4] text-xs text-white hover:bg-[#015a9e]"
            >
              Apply Filters
            </Button>
          </div>
        </form>

        {(deviceId || userEmail) && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Showing requests from</span>
            <span className="font-mono font-medium text-foreground">
              {deviceId ? `device ${deviceId}` : userEmail}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setDeviceId("");
                setUserEmail("");
                setOffset(0);
              }}
            >
              Clear
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Querying request logs...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Request log query failed:</span>
            </div>
            <p className="mt-1">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No request logs matched the specified filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Duration</th>
                    <th className="px-3 py-2">User / Device</th>
                    <th className="px-3 py-2">Error Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelected(log)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open details for ${log.method} ${log.path}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(log);
                        }
                      }}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-foreground">
                        {log.method}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2 font-mono text-xs text-foreground" title={log.path}>
                        {log.path}
                      </td>
                      <td className="px-3 py-2">{getStatusBadge(log.status_code)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                        {formatDuration(log.duration_ms)}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-[11px] text-muted-foreground">
                        {log.user_email || (log.device_id ? `Device: ${log.device_id.slice(0, 8)}…` : "—")}
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-2 text-[11px] text-red-600" title={log.error_detail || ""}>
                        {log.error_detail || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>
                Showing rows {offset + 1} – {offset + logs.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || loading || refreshing}
                  onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                  className="h-7 px-2 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logs.length < limit || loading || refreshing}
                  onClick={() => setOffset((prev) => prev + limit)}
                  className="h-7 px-2 text-xs"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}

        <RequestLogDetailModal
          summary={selected}
          onClose={() => setSelected(null)}
          onPivot={handlePivot}
        />
      </CardContent>
    </Card>
  );
}
