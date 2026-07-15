"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, RefreshCw, AlertTriangle, Check, X } from "lucide-react";
import { getSensorHealth, purgeBadTimestamps } from "@/lib/api/sensor-health";
import {
  SensorHealthResponse,
  SensorHealthStation,
  SensorHealthStatus,
} from "@/lib/api/types";

const AUTO_REFRESH_MS = 60_000;

const PERIOD_OPTIONS = [
  { label: "24h", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "1y", value: 365 },
] as const;

const STATUS_STYLES: Record<
  SensorHealthStatus,
  { label: string; badge: string; dot: string }
> = {
  online: {
    label: "Online",
    badge: "bg-green-100 text-green-800 ring-green-600/20",
    dot: "bg-green-500",
  },
  stale: {
    label: "Stale",
    badge: "bg-amber-100 text-amber-800 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  offline: {
    label: "Offline",
    badge: "bg-red-100 text-red-800 ring-red-600/20",
    dot: "bg-red-500",
  },
  no_data: {
    label: "No data",
    badge: "bg-gray-100 text-gray-700 ring-gray-500/20",
    dot: "bg-gray-400",
  },
};

const METRIC_LABELS: Array<{ key: keyof SensorHealthStation["metrics"]; label: string }> = [
  { key: "pm1_0", label: "PM1.0" },
  { key: "pm2_5", label: "PM2.5" },
  { key: "pm4_0", label: "PM4.0" },
  { key: "pm10", label: "PM10" },
  { key: "temperature", label: "Temp" },
  { key: "humidity", label: "Humidity" },
  { key: "voc_index", label: "VOC" },
  { key: "nox_index", label: "NOx" },
];

// Format hours-since-last-reading into a compact relative "last seen" label.
function formatLastSeen(hours: number | null, lastReading: string | null): string {
  if (lastReading === null || hours === null) return "never";
  if (hours < 0) return "just now";
  const minutes = hours * 60;
  if (minutes < 1) return "just now";
  if (hours < 1) return `${Math.round(minutes)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatGeneratedAt(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function coverageBarColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-500";
}

function StatusBadge({ status }: { status: SensorHealthStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.no_data;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "green" | "amber" | "red" | "gray";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-600"
      : tone === "amber"
      ? "text-amber-600"
      : tone === "red"
      ? "text-red-600"
      : tone === "gray"
      ? "text-gray-500"
      : "text-foreground";
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function CoverageBar({ station }: { station: SensorHealthStation }) {
  const pct = Math.max(0, Math.min(100, station.coverage_24h_pct));
  return (
    <div className="min-w-[9rem]">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{pct.toFixed(1)}%</span>
        <span className="text-muted-foreground tabular-nums">
          {station.readings_24h.toLocaleString()} / {station.expected_24h.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${coverageBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MetricChips({ station }: { station: SensorHealthStation }) {
  return (
    <div className="flex flex-wrap gap-1">
      {METRIC_LABELS.map(({ key, label }) => {
        const m = station.metrics[key];
        const pct = m?.fill_pct ?? 0;
        const chipClass =
          pct <= 0
            ? "bg-red-50 text-red-700 ring-red-600/20"
            : pct >= 95
            ? "bg-green-50 text-green-700 ring-green-600/20"
            : pct >= 50
            ? "bg-amber-50 text-amber-700 ring-amber-600/20"
            : "bg-gray-100 text-gray-600 ring-gray-500/20";
        return (
          <span
            key={key}
            title={`${label}: ${pct.toFixed(1)}% filled (${m?.filled ?? 0} readings)`}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${chipClass}`}
          >
            {label}
            <span className="tabular-nums opacity-80">{Math.round(pct)}%</span>
          </span>
        );
      })}
    </div>
  );
}

function StationCard({
  station,
  onFix,
  fixing,
}: {
  station: SensorHealthStation;
  onFix: (station: SensorHealthStation) => void;
  fixing: boolean;
}) {
  const eqPct = station.pm25_eq_pm10_pct;
  const eqAmber = eqPct > 50;
  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4 px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{station.station}</p>
            <p className="truncate text-xs text-muted-foreground">{station.serial_number}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={station.status} />
            <span className="text-[11px] text-muted-foreground">
              {formatLastSeen(station.hours_since_last, station.last_reading)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total readings
            </p>
            <p className="text-sm font-medium tabular-nums">
              {station.total_readings.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              24h coverage
            </p>
            <CoverageBar station={station} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {station.bad_timestamp_count > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
              <AlertTriangle className="h-3 w-3" />
              {station.bad_timestamp_count} bad timestamp
              {station.bad_timestamp_count === 1 ? "" : "s"}
              <button
                type="button"
                onClick={() => onFix(station)}
                disabled={fixing}
                className="ml-1 inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {fixing ? "Fixing…" : "Fix"}
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-600" /> timestamps ok
            </span>
          )}

          <span
            title={`PM10 duplicates PM2.5 in ${eqPct.toFixed(1)}% of readings (possible firmware issue)`}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
              eqAmber
                ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                : "bg-gray-100 text-gray-600 ring-gray-500/20"
            }`}
          >
            PM2.5=PM10: {eqPct.toFixed(1)}%
          </span>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Metric fill
          </p>
          <MetricChips station={station} />
        </div>
      </CardContent>
    </Card>
  );
}

function DiagnosticsContent() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<SensorHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixingDeviceId, setFixingDeviceId] = useState<string | null>(null);
  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const dataRef = useRef<SensorHealthResponse | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (isInitial: boolean) => {
    if (!isInitial && inFlight.current) return;
    const currentId = ++requestIdRef.current;
    inFlight.current = true;
    if (isInitial && !dataRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getSensorHealth(days);
      if (!isMounted.current || requestIdRef.current !== currentId) return;
      dataRef.current = res;
      setData(res);
      setError(null);
    } catch (err: unknown) {
      if (!isMounted.current || requestIdRef.current !== currentId) return;
      setError(err instanceof Error ? err.message : "Failed to load sensor health");
    } finally {
      if (isMounted.current && requestIdRef.current === currentId) {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [days]);

  const handleFix = useCallback(
    async (station: SensorHealthStation) => {
      const count = station.bad_timestamp_count;
      const confirmed = window.confirm(
        `Remove ${count} reading(s) with invalid timestamps from ${station.station}? This cannot be undone.`
      );
      if (!confirmed) return;
      setFixingDeviceId(station.device_id);
      try {
        await purgeBadTimestamps(station.device_id);
        if (!isMounted.current) return;
        await load(false);
      } catch (err: unknown) {
        if (!isMounted.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to purge bad timestamps"
        );
      } finally {
        if (isMounted.current) setFixingDeviceId(null);
      }
    },
    [load]
  );

  useEffect(() => {
    isMounted.current = true;
    load(true);
    const interval = setInterval(() => {
      // Skip background refreshes while the tab is hidden.
      if (document.visibilityState === "hidden") return;
      load(false);
    }, AUTO_REFRESH_MS);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [load]);

  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sensor Health</h1>
          <p className="text-sm text-muted-foreground">
            {data ? (
              <>
                Generated {formatGeneratedAt(data.generated_at)}
                {data.window_days !== undefined && (
                  <span className="ml-2">
                    · {data.window_days === 1 ? "Last 24 hours" : `Showing data from the last ${data.window_days} days`}
                  </span>
                )}
              </>
            ) : (
              "Live diagnostics for all sensor stations"
            )}
            <span className="ml-2 text-xs text-muted-foreground/70">
              · auto-refreshes every 60s
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={days === option.value ? "default" : "ghost"}
                className={
                  days === option.value
                    ? "h-8 bg-[#016FC4] text-white hover:bg-[#015a9e]"
                    : "h-8 text-muted-foreground hover:text-foreground"
                }
                disabled={loading && !data}
                onClick={() => setDays(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => load(false)}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState
          variant="inline"
          message="Loading sensor health"
          hint="Querying diagnostics for all stations"
          className="py-12"
        />
      ) : !data ? (
        <p className="py-12 text-center text-muted-foreground">No diagnostics available.</p>
      ) : (
        <>
          {summary && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <SummaryCard label="Stations" value={summary.stations} />
              <SummaryCard label="Online" value={summary.online} tone="green" />
              <SummaryCard label="Stale" value={summary.stale} tone="amber" />
              <SummaryCard label="Offline" value={summary.offline} tone="red" />
              <SummaryCard label="No data" value={summary.no_data} tone="gray" />
              <SummaryCard
                label="Total readings"
                value={summary.total_readings.toLocaleString()}
              />
              <SummaryCard
                label="Bad timestamps"
                value={summary.total_bad_timestamps}
                tone={summary.total_bad_timestamps > 0 ? "red" : "default"}
              />
            </div>
          )}

          {data.stations.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No stations found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.stations.map((station) => (
                <StationCard
                  key={station.device_id}
                  station={station}
                  onFix={handleFix}
                  fixing={fixingDeviceId === station.device_id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <AdminRouteGuard>
      <AppShell
        sectionLabel="Administration"
        title="Sensor Health"
        subtitle="Diagnostics for all sensor stations"
        icon={Activity}
        mainClassName="bg-transparent"
      >
        <DiagnosticsContent />
      </AppShell>
    </AdminRouteGuard>
  );
}
