import { SensorReadingsParams, SensorSeriesParams } from "@/lib/api/types";

export type ChartRangePreset = "6h" | "24h" | "7d" | "30d" | "1y" | "custom";

/**
 * The chart window. Presets are rolling windows ending now; "custom" is an
 * explicit range the user typed, held as YYYY-MM-DD (plus optional HH:mm) so it
 * survives being put in a URL or a query key without timezone ambiguity.
 *
 * The times are optional on purpose: a typed range covers whole days unless the
 * user opts into a time of day, which keeps the common case a two-field one.
 */
export interface ChartTimeRange {
  preset: ChartRangePreset;
  /** Inclusive first day (custom only). */
  start?: string;
  /** Inclusive last day (custom only). */
  end?: string;
  /** HH:mm on the first day. Absent means from the start of that day. */
  startTime?: string;
  /** HH:mm on the last day. Absent means through the end of that day. */
  endTime?: string;
}

export interface ChartTimeRangeOption {
  id: Exclude<ChartRangePreset, "custom">;
  label: string;
  description: string;
}

export const CHART_TIME_RANGE_OPTIONS: ChartTimeRangeOption[] = [
  { id: "6h", label: "6H", description: "Last 6 hours · 5 min buckets (~72 points)" },
  { id: "24h", label: "24H", description: "Last 24 hours · 15 min buckets (~96 points)" },
  { id: "7d", label: "7D", description: "Last 7 days · hourly buckets (~168 points)" },
  { id: "30d", label: "30D", description: "Last 30 days · daily buckets (~30 points)" },
  { id: "1y", label: "1Y", description: "Last year · daily buckets (~365 points)" },
];

export const DEFAULT_CHART_TIME_RANGE: ChartTimeRange = { preset: "24h" };

/**
 * Readings are stored and bucketed in EAT (see the backend's session timezone),
 * and Ethiopia has no DST, so a typed day is pinned to a constant +03:00 rather
 * than to whatever zone the browser happens to be in.
 */
const EAT_OFFSET = "+03:00";

/** Longest custom window we let through — matches the backend's 365-day cap. */
export const MAX_CUSTOM_RANGE_DAYS = 365;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * The whole-day boundaries a typed range falls back to. The end runs to the
 * last millisecond of its minute, so an explicit 23:59 lands in exactly the
 * same place as no time at all — switching times on never moves the window.
 */
const DAY_START = "00:00";
const DAY_END = "23:59";

/** True when a custom range is filled in and usable. */
export function isCompleteRange(range: ChartTimeRange): boolean {
  if (range.preset !== "custom") return true;
  return validateCustomRange(range) === null;
}

/**
 * Why a typed range can't be used, or null when it's fine. The message is shown
 * verbatim under the inputs.
 */
export function validateCustomRange(range: ChartTimeRange): string | null {
  const { start, end } = range;
  if (!start || !end) return "Pick both a start and an end date.";
  const startMs = Date.parse(rangeStartIso(range));
  const endMs = Date.parse(rangeEndIso(range));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "Enter valid dates.";
  if (endMs <= startMs) return "The end must be after the start.";
  const spanDays = Math.ceil((endMs - startMs) / DAY_MS);
  if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
    return `Ranges are limited to ${MAX_CUSTOM_RANGE_DAYS} days — this one is ${spanDays}.`;
  }
  return null;
}

function rangeStartIso(range: ChartTimeRange): string {
  return `${range.start}T${range.startTime ?? DAY_START}:00.000${EAT_OFFSET}`;
}

function rangeEndIso(range: ChartTimeRange): string {
  return `${range.end}T${range.endTime ?? DAY_END}:59.999${EAT_OFFSET}`;
}

/** How long a typed range runs, in hours. */
function customSpanHours(range: ChartTimeRange): number {
  const startMs = Date.parse(rangeStartIso(range));
  const endMs = Date.parse(rangeEndIso(range));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 24;
  return Math.max(1 / 60, (endMs - startMs) / HOUR_MS);
}

/**
 * Bucket size for a typed range, picked to keep the point count in the same
 * ballpark as the presets (roughly 100-400 points) so charts stay readable and
 * the backend's bucket-count guard is never tripped. The thresholds line up
 * with the presets: 6h→5m, 24h→15m, 7d→1h, 30d→1d.
 */
function intervalForSpanHours(hours: number): SensorSeriesParams["interval"] {
  if (hours <= 2) return "1m";
  if (hours <= 8) return "5m";
  if (hours <= 48) return "15m";
  if (hours <= 21 * 24) return "1h";
  return "1d";
}

/**
 * Start/end instants for a custom range. Without times this is the whole first
 * day through the whole last day; with them, the typed minutes (the end minute
 * included).
 */
export function customRangeBounds(range: ChartTimeRange): { start_date: string; end_date: string } {
  return {
    start_date: rangeStartIso(range),
    end_date: rangeEndIso(range),
  };
}

/**
 * Maps a chart window to /sensor-readings/series query params.
 * Every window requests an explicit interval so the backend never falls back to
 * its 1-minute default (~1440 buckets/device for 24h). Valid backend interval
 * labels: auto, 1m, 5m, 15m, 1h, 1d.
 */
export function chartRangeToSeriesParams(range: ChartTimeRange): Partial<SensorSeriesParams> {
  switch (range.preset) {
    case "6h":
      return { hours: 6, interval: "5m" };
    case "24h":
      return { hours: 24, interval: "15m" };
    case "7d":
      return { days: 7, interval: "1h" };
    case "30d":
      return { days: 30, interval: "1d" };
    case "1y":
      return { days: 365, interval: "1d" };
    case "custom":
      return {
        ...customRangeBounds(range),
        interval: intervalForSpanHours(customSpanHours(range)),
      };
  }
}

/** Merge page filters with the chart window (the window wins on time params). */
export function applyChartTimeRange(
  filters: SensorReadingsParams,
  range: ChartTimeRange
): SensorReadingsParams {
  const rangeParams = chartRangeToSeriesParams(range);
  const next: SensorReadingsParams = { ...filters };

  delete next.hours;
  delete next.days;
  delete next.today;
  delete next.yesterday;
  delete next.this_week;
  delete next.this_month;
  delete next.start_date;
  delete next.end_date;
  delete next.recorded_date;

  if (rangeParams.hours !== undefined) next.hours = rangeParams.hours;
  if (rangeParams.days !== undefined) next.days = rangeParams.days;
  if (rangeParams.start_date) next.start_date = rangeParams.start_date;
  if (rangeParams.end_date) next.end_date = rangeParams.end_date;

  delete next.interval;
  if (rangeParams.interval) next.interval = rangeParams.interval;

  return next;
}

/** Days a window covers — the axis and tick spacing key off this, not the preset. */
function rangeSpanDays(range: ChartTimeRange): number {
  switch (range.preset) {
    case "custom":
      return customSpanHours(range) / 24;
    case "1y":
      return 365;
    case "30d":
      return 30;
    case "7d":
      return 7;
    default:
      return 1;
  }
}

/** Minimum px between x-axis ticks — wider date labels need more room. */
export function axisTickGap(range: ChartTimeRange): number {
  const days = rangeSpanDays(range);
  if (days > 90) return 48;
  if (days > 21) return 32;
  return 16;
}

export function formatAxisTimeForRange(ts: unknown, range: ChartTimeRange): string {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n)) return String(ts ?? "");

  const date = new Date(n);
  const spanDays = rangeSpanDays(range);

  if (spanDays > 90) {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  if (spanDays > 3) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (spanDays > 1) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/** Base params for series/table requests (time range applied separately). */
export function seriesFiltersForRange(range: ChartTimeRange): SensorReadingsParams {
  return applyChartTimeRange({ timezone: "Africa/Addis_Ababa" }, range);
}

/** Stable identity for a window — used as a query key, so custom bounds count. */
export function chartRangeKey(range: ChartTimeRange): string {
  if (range.preset !== "custom") return range.preset;
  const times = `${range.startTime ?? ""}|${range.endTime ?? ""}`;
  return `custom|${range.start ?? ""}|${range.end ?? ""}|${times}`;
}

function formatDay(day: string | undefined): string {
  if (!day) return "—";
  const ms = Date.parse(`${day}T00:00:00${EAT_OFFSET}`);
  if (!Number.isFinite(ms)) return day;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Jul 15, 2026" for a whole day, "Jul 15, 2026 09:30" when a time is set. */
function formatBound(day: string | undefined, time: string | undefined): string {
  return time ? `${formatDay(day)} ${time}` : formatDay(day);
}

export function chartWindowTitle(range: ChartTimeRange): string {
  if (range.preset === "custom") {
    const hasTimes = range.startTime !== undefined || range.endTime !== undefined;
    // A single whole day reads better as just that day.
    if (range.start === range.end && !hasTimes) return formatDay(range.start);
    const from = formatBound(range.start, range.startTime);
    const to =
      range.start === range.end && range.endTime
        ? range.endTime
        : formatBound(range.end, range.endTime);
    return `${from} – ${to}`;
  }
  const titles: Record<Exclude<ChartRangePreset, "custom">, string> = {
    "6h": "6 Hours",
    "24h": "24 Hours",
    "7d": "7 Days",
    "30d": "30 Days",
    "1y": "1 Year",
  };
  return titles[range.preset];
}

/** Prose for "current chart range (…)" style captions. */
export function chartWindowCaption(range: ChartTimeRange): string {
  return range.preset === "custom"
    ? chartWindowTitle(range)
    : `last ${chartWindowTitle(range).toLowerCase()}`;
}

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The EAT calendar day an instant falls on, as YYYY-MM-DD. */
function toEatDay(ms: number): string {
  return new Date(ms + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today in EAT as YYYY-MM-DD — the ceiling for the date inputs. */
export function todayInEat(): string {
  return toEatDay(Date.now());
}

/** Sensible first guess when the user switches to custom: the last 7 days. */
export function defaultCustomRange(): ChartTimeRange {
  const end = todayInEat();
  // EAT midnight is 21:00 UTC the day before, so shift back into EAT before
  // reading the calendar day off the ISO string.
  const endMs = Date.parse(`${end}T00:00:00${EAT_OFFSET}`);
  return { preset: "custom", start: toEatDay(endMs - 6 * DAY_MS), end };
}
