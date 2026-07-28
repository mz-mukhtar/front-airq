"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";
import {
  getSensorHealth,
  purgeBadTimestamps,
  SensorHealthWindow,
} from "@/lib/api/sensor-health";
import { DateRangeFields, TypedDateRange } from "@/components/ui/date-range-fields";
import {
  ANALYTICS_METRICS,
  AnalyticsMetric,
  MetricStatistics,
  getDevicePercentiles,
  getDeviceStatistics,
} from "@/lib/api/analytics";
import {
  SensorHealthResponse,
  SensorHealthStation,
} from "@/lib/api/types";
import {
  StatusBadge,
  formatLastSeen,
} from "@/components/diagnostics/health-status";
import { InfrastructureStatus } from "@/components/diagnostics/InfrastructureStatus";
import { RequestLogViewer } from "@/components/diagnostics/RequestLogViewer";

const AUTO_REFRESH_MS = 60_000;

/**
 * The one window control on this page. It drives everything the report says
 * about readings — counts, coverage, fill rates, duplication and the per-station
 * analytics panel — so a figure on a card can always be read against the label
 * at the top. Backend accepts hours 1-8760.
 */
const WINDOW_OPTIONS: Array<{ label: string; hours: number }> = [
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 7 * 24 },
  { label: "30d", hours: 30 * 24 },
  { label: "90d", hours: 90 * 24 },
  { label: "1y", hours: 365 * 24 },
];

const DEFAULT_WINDOW_HOURS = 6;

/**
 * The window is either one of the presets (rolling, ending now) or a pair of
 * typed days. A typed range is the only way to ask about a period that has
 * already ended — `hours` always counts back from now.
 */
type DiagnosticsWindow =
  | { kind: "rolling"; hours: number }
  | {
      kind: "custom";
      start: string;
      end: string;
      /** HH:mm; absent means whole days. */
      startTime?: string;
      endTime?: string;
    };

const DEFAULT_WINDOW: DiagnosticsWindow = { kind: "rolling", hours: DEFAULT_WINDOW_HOURS };

/** Compact label for a window in hours: "6h", "24h", "7d", "1y". */
function windowLabel(hours: number): string {
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days % 365 === 0 ? `${days / 365}y` : `${days}d`;
}

/** Prose form for the page subtitle: "the last 6 hours", "the last 30 days". */
function windowDescription(hours: number): string {
  if (hours < 48) return `the last ${hours} hours`;
  const days = Math.round(hours / 24);
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? "the last year" : `the last ${years} years`;
  }
  return `the last ${days} days`;
}

/** Compact label for any window, for the "Readings (6h)" style captions. */
function windowShortLabel(selection: DiagnosticsWindow): string {
  if (selection.kind === "rolling") return windowLabel(selection.hours);
  const short = (day: string, time?: string) => {
    const ms = Date.parse(`${day}T00:00:00${EAT_OFFSET}`);
    const label = Number.isFinite(ms)
      ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : day;
    return time ? `${label} ${time}` : label;
  };
  const sameDay = selection.start === selection.end;
  if (sameDay && !hasTimes(selection)) return short(selection.start);
  const to =
    sameDay && selection.endTime
      ? selection.endTime
      : short(selection.end, selection.endTime);
  return `${short(selection.start, selection.startTime)} – ${to}`;
}

/** True when the user set an explicit time of day on either end. */
function hasTimes(selection: DiagnosticsWindow): boolean {
  return (
    selection.kind === "custom" &&
    (selection.startTime !== undefined || selection.endTime !== undefined)
  );
}

/** Prose form for a typed range: "Jul 15, 2026 – Jul 24, 2026", times included. */
function customWindowDescription(selection: DiagnosticsWindow & { kind: "custom" }): string {
  const fmt = (day: string, time?: string) => {
    const ms = Date.parse(`${day}T00:00:00${EAT_OFFSET}`);
    const label = Number.isFinite(ms)
      ? new Date(ms).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : day;
    return time ? `${label} ${time}` : label;
  };
  const sameDay = selection.start === selection.end;
  if (sameDay && !hasTimes(selection)) return fmt(selection.start);
  const to =
    sameDay && selection.endTime
      ? selection.endTime
      : fmt(selection.end, selection.endTime);
  return `${fmt(selection.start, selection.startTime)} – ${to}`;
}

/** Readings are stored in EAT and Ethiopia has no DST, so this is constant. */
const EAT_OFFSET = "+03:00";
const DAY_MS = 86_400_000;
const MAX_WINDOW_DAYS = 365;

/** Today in EAT as YYYY-MM-DD — the ceiling for the date inputs. */
function todayInEat(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Whole-day boundaries a typed range falls back to. The end runs to the last
 * millisecond of its minute, so an explicit 23:59 lands exactly where no time
 * at all does — revealing the time fields never moves the window.
 */
const DAY_START = "00:00";
const DAY_END = "23:59";

function boundIso(day: string, time: string, endOfMinute: boolean): string {
  return `${day}T${time}:${endOfMinute ? "59.999" : "00.000"}${EAT_OFFSET}`;
}

/** Why a typed range can't be used, or null when it's fine. */
function validateWindowRange(range: TypedDateRange): string | null {
  const { start, end, startTime, endTime } = range;
  if (!start || !end) return "Pick both a start and an end date.";
  const startMs = Date.parse(boundIso(start, startTime ?? DAY_START, false));
  const endMs = Date.parse(boundIso(end, endTime ?? DAY_END, true));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "Enter valid dates.";
  if (endMs <= startMs) return "The end must be after the start.";
  const spanDays = Math.ceil((endMs - startMs) / DAY_MS);
  if (spanDays > MAX_WINDOW_DAYS) {
    return `Ranges are limited to ${MAX_WINDOW_DAYS} days — this one is ${spanDays}.`;
  }
  return null;
}

/** The API window for a selection: whole days unless a time was set, in EAT. */
function toApiWindow(selection: DiagnosticsWindow): SensorHealthWindow {
  if (selection.kind === "rolling") return { hours: selection.hours };
  return {
    start_date: boundIso(selection.start, selection.startTime ?? DAY_START, false),
    end_date: boundIso(selection.end, selection.endTime ?? DAY_END, true),
  };
}

/** Stable identity for a window — used as a render key and an effect dep. */
function windowIdentity(selection: DiagnosticsWindow): string {
  return selection.kind === "rolling"
    ? `rolling:${selection.hours}`
    : `custom:${selection.start}:${selection.end}:${selection.startTime ?? ""}:${selection.endTime ?? ""}`;
}

/** Last 7 days — the seed when the user first switches to a typed range. */
function defaultCustomWindow(): DiagnosticsWindow {
  const end = todayInEat();
  const endMs = Date.parse(`${end}T00:00:00${EAT_OFFSET}`);
  const start = new Date(endMs - 6 * DAY_MS + 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { kind: "custom", start, end };
}

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

const ANALYTICS_METRIC_LABELS: Record<AnalyticsMetric, string> = {
  pm2_5: "PM2.5 (µg/m³)",
  pm10: "PM10 (µg/m³)",
  temperature: "Temp (°C)",
  humidity: "Humidity (%)",
  voc_index: "VOC index",
  nox_index: "NOx index",
};

// A metric with variance this low across many readings is likely stuck
const STUCK_STDDEV_THRESHOLD = 0.001;
const STUCK_MIN_COUNT = 10;

function formatGeneratedAt(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

/** Whole days between an ISO date and now (device age). */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function coverageBarColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-500";
}

const DEVICE_STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 ring-blue-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  inactive: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

function DeviceStatusBadge({ status }: { status: string }) {
  const cls = DEVICE_STATUS_STYLES[status] ?? DEVICE_STATUS_STYLES.inactive;
  return (
    <span
      title="Device registration status"
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
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
  const pct = Math.max(0, Math.min(100, station.coverage_pct));
  // Devices installed part-way into the window are measured from their first
  // reading, not the window start — surface that so the ratio isn't puzzling.
  const partial =
    station.first_reading !== null && station.coverage_since === station.first_reading;
  return (
    <div className="min-w-[9rem]">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{pct.toFixed(1)}%</span>
        <span
          className="text-muted-foreground tabular-nums"
          title={
            partial
              ? `Measured from this device's first reading (${new Date(station.coverage_since).toLocaleString()}), not the full window`
              : `Expected one reading per minute since ${new Date(station.coverage_since).toLocaleString()}`
          }
        >
          {station.readings_window.toLocaleString()} /{" "}
          {station.expected_window.toLocaleString()}
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

/**
 * Lazy per-station analytics: distribution stats (avg/min/max/stddev) and
 * percentiles (p50/p95/p99) per metric over the selected window. Fetched only
 * when the panel is opened; re-fetched when the window changes.
 */
function StationAnalytics({
  deviceId,
  window: selection,
}: {
  deviceId: string;
  window: DiagnosticsWindow;
}) {
  const [stats, setStats] = useState<Record<AnalyticsMetric, MetricStatistics> | null>(null);
  const [percentiles, setPercentiles] = useState<Record<
    AnalyticsMetric,
    Record<string, number | null>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // No sync state resets needed here: the parent remounts this component via
  // a window-derived key when the window changes, so initial state is always fresh.
  const apiWindow = toApiWindow(selection);
  const windowKey = windowIdentity(selection);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getDeviceStatistics(deviceId, apiWindow),
      getDevicePercentiles(deviceId, apiWindow),
    ])
      .then(([statsRes, pctRes]) => {
        if (cancelled) return;
        setStats(statsRes.statistics);
        setPercentiles(pctRes.metrics);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // apiWindow is rebuilt every render; windowKey is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, windowKey]);

  if (loading) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        Loading analytics…
      </p>
    );
  }

  if (error) {
    return <p className="py-3 text-center text-xs text-destructive">{error}</p>;
  }

  if (!stats) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="p-1.5 text-left font-medium">Metric</th>
            <th className="p-1.5 text-right font-medium">Avg</th>
            <th className="p-1.5 text-right font-medium">Min</th>
            <th className="p-1.5 text-right font-medium">Max</th>
            <th className="p-1.5 text-right font-medium">σ</th>
            <th className="p-1.5 text-right font-medium">p50</th>
            <th className="p-1.5 text-right font-medium">p95</th>
            <th className="p-1.5 text-right font-medium">p99</th>
            <th className="p-1.5 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {ANALYTICS_METRICS.map((metric) => {
            const s = stats[metric];
            const p = percentiles?.[metric];
            const stuck =
              s &&
              s.count >= STUCK_MIN_COUNT &&
              s.stddev !== null &&
              s.stddev <= STUCK_STDDEV_THRESHOLD;
            return (
              <tr key={metric} className="border-b border-border/50">
                <td className="p-1.5 text-left">
                  {ANALYTICS_METRIC_LABELS[metric]}
                  {stuck && (
                    <span
                      title="Near-zero variance across many readings — the sensor may be stuck"
                      className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      stuck?
                    </span>
                  )}
                </td>
                <td className="p-1.5 text-right">{fmt(s?.avg)}</td>
                <td className="p-1.5 text-right">{fmt(s?.min)}</td>
                <td className="p-1.5 text-right">{fmt(s?.max)}</td>
                <td className="p-1.5 text-right">{fmt(s?.stddev, 2)}</td>
                <td className="p-1.5 text-right">{fmt(p?.p50)}</td>
                <td className="p-1.5 text-right">{fmt(p?.p95)}</td>
                <td className="p-1.5 text-right">{fmt(p?.p99)}</td>
                <td className="p-1.5 text-right">{s?.count?.toLocaleString() ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StationCard({
  station,
  window: selection,
  onFix,
  fixing,
}: {
  station: SensorHealthStation;
  window: DiagnosticsWindow;
  onFix: (station: SensorHealthStation) => void;
  fixing: boolean;
}) {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const eqPct = station.pm25_eq_pm10_pct;
  const eqAmber = eqPct > 50;
  const age = daysSince(station.first_reading);
  const windowTag = windowShortLabel(selection);

  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4 px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{station.station}</p>
            <p className="truncate text-xs text-muted-foreground">
              {station.serial_number} <DeviceStatusBadge status={station.device_status} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              First seen {formatDate(station.first_reading)}
              {age !== null && ` · ${age}d active`}
            </p>
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
              Readings ({windowTag})
            </p>
            <p className="text-sm font-medium tabular-nums">
              {station.total_readings.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Coverage ({windowTag})
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
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${eqAmber
                ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                : "bg-gray-100 text-gray-600 ring-gray-500/20"
              }`}
          >
            PM2.5=PM10: {eqPct.toFixed(1)}%
          </span>

          <Link
            href={`/sensors?device=${station.device_id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View charts
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Metric fill ({windowTag})
          </p>
          <MetricChips station={station} />
        </div>

        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setAnalyticsOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={analyticsOpen}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Detailed analytics ({windowTag})
            {analyticsOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {analyticsOpen && (
            <div className="mt-2">
              <StationAnalytics
                key={windowIdentity(selection)}
                deviceId={station.device_id}
                window={selection}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DiagnosticsContent() {
  const [activeTab, setActiveTab] = useState<"sensor_health" | "infrastructure" | "request_logs">("sensor_health");
  const [data, setData] = useState<SensorHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixingDeviceId, setFixingDeviceId] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<DiagnosticsWindow>(DEFAULT_WINDOW);
  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const dataRef = useRef<SensorHealthResponse | null>(null);
  const requestIdRef = useRef(0);

  // Takes the window as an argument rather than closing over it, so a refresh
  // can never fire with a stale window.
  // (not named `window` — that would shadow the global one this file uses.)
  const load = useCallback(async (isInitial: boolean, selection: DiagnosticsWindow) => {
    if (!isInitial && inFlight.current) return;
    const currentId = ++requestIdRef.current;
    inFlight.current = true;
    if (isInitial && !dataRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getSensorHealth(toApiWindow(selection));
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
  }, []);

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
        await load(false, selectedWindow);
      } catch (err: unknown) {
        if (!isMounted.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to purge bad timestamps"
        );
      } finally {
        if (isMounted.current) setFixingDeviceId(null);
      }
    },
    [load, selectedWindow]
  );

  useEffect(() => {
    isMounted.current = true;
    load(true, selectedWindow);
    const interval = setInterval(() => {
      // Skip background refreshes while the tab is hidden.
      if (document.visibilityState === "hidden") return;
      load(false, selectedWindow);
    }, AUTO_REFRESH_MS);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [load, selectedWindow]);

  const summary = data?.summary;
  const isCustomWindow = selectedWindow.kind === "custom";
  // A typed range is a fixed period, so it is named by its dates rather than
  // being described as "the last N days".
  const windowCaption =
    selectedWindow.kind === "custom"
      ? customWindowDescription(selectedWindow)
      : windowDescription(data?.window_hours ?? selectedWindow.hours);

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 space-y-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-border pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("sensor_health")}
          className={`flex items-center gap-2 border-b-2 py-2.5 px-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === "sensor_health"
              ? "border-[#016FC4] text-[#016FC4]"
              : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground"
            }`}
        >
          <Activity className="h-4 w-4" />
          Sensor Health
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("infrastructure")}
          className={`flex items-center gap-2 border-b-2 py-2.5 px-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === "infrastructure"
              ? "border-[#016FC4] text-[#016FC4]"
              : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground"
            }`}
        >
          <Database className="h-4 w-4" />
          Infrastructure
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("request_logs")}
          className={`flex items-center gap-2 border-b-2 py-2.5 px-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === "request_logs"
              ? "border-[#016FC4] text-[#016FC4]"
              : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground"
            }`}
        >
          <FileText className="h-4 w-4" />
          Request Logs
        </button>
      </div>

      {activeTab === "sensor_health" && (
        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Sensor Health</h1>
              <p className="text-sm text-muted-foreground">
                {data ? (
                  <>
                    Generated {formatGeneratedAt(data.generated_at)}
                    <span className="ml-2">
                      · Readings, coverage and fill rates over{" "}
                      {windowCaption}
                    </span>
                  </>
                ) : (
                  "Live diagnostics for all sensor stations"
                )}
                <span className="ml-2 text-xs text-muted-foreground/70">
                  · auto-refreshes every 60s
                </span>
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex rounded-lg border bg-muted/40 p-0.5"
                  role="group"
                  aria-label="Diagnostics window"
                >
                  {WINDOW_OPTIONS.map((option) => {
                    const active =
                      selectedWindow.kind === "rolling" && selectedWindow.hours === option.hours;
                    return (
                      <Button
                        key={option.hours}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "ghost"}
                        className={
                          active
                            ? "h-8 bg-[#016FC4] text-white hover:bg-[#015a9e]"
                            : "h-8 text-muted-foreground hover:text-foreground"
                        }
                        aria-pressed={active}
                        disabled={loading && !data}
                        onClick={() => setSelectedWindow({ kind: "rolling", hours: option.hours })}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    size="sm"
                    variant={isCustomWindow ? "default" : "ghost"}
                    className={
                      isCustomWindow
                        ? "h-8 bg-[#016FC4] text-white hover:bg-[#015a9e]"
                        : "h-8 text-muted-foreground hover:text-foreground"
                    }
                    aria-pressed={isCustomWindow}
                    title="Type an exact start and end date"
                    disabled={loading && !data}
                    onClick={() => !isCustomWindow && setSelectedWindow(defaultCustomWindow())}
                  >
                    Custom
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => load(false, selectedWindow)}
                  disabled={loading || refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              {selectedWindow.kind === "custom" && (
                <DateRangeFields
                  idPrefix="diagnostics-window"
                  value={{
                    start: selectedWindow.start,
                    end: selectedWindow.end,
                    startTime: selectedWindow.startTime,
                    endTime: selectedWindow.endTime,
                  }}
                  max={todayInEat()}
                  disabled={loading && !data}
                  validate={validateWindowRange}
                  hint={
                    hasTimes(selectedWindow)
                      ? "Start and end times are inclusive, in Addis Ababa time."
                      : "Both days are included in full, in Addis Ababa time."
                  }
                  onApply={({ start, end, startTime, endTime }) =>
                    setSelectedWindow({ kind: "custom", start, end, startTime, endTime })
                  }
                />
              )}
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
                    label={`Readings (${windowShortLabel(selectedWindow)})`}
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
                      window={selectedWindow}
                      onFix={handleFix}
                      fixing={fixingDeviceId === station.device_id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "infrastructure" && <InfrastructureStatus />}

      {activeTab === "request_logs" && <RequestLogViewer />}
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <AdminRouteGuard>
      <AppShell
        sectionLabel="Administration"
        title="System Diagnostics"
        subtitle="Sensor health, database infrastructure, and API request logs"
        icon={Activity}
        mainClassName="bg-transparent"
      >
        <DiagnosticsContent />
      </AppShell>
    </AdminRouteGuard>
  );
}
