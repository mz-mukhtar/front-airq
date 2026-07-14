import { SensorReadingsParams, SensorSeriesParams } from "@/lib/api/types";

export type ChartTimeRange = "6h" | "24h" | "7d" | "30d" | "1y";

export interface ChartTimeRangeOption {
  id: ChartTimeRange;
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

/**
 * Maps chart presets to /sensor-readings/series query params.
 * Every preset requests an explicit interval so the backend never falls back to
 * its 1-minute default (~1440 buckets/device for 24h). Valid backend interval
 * labels: auto, 1m, 5m, 15m, 1h, 1d.
 */
export function chartRangeToSeriesParams(range: ChartTimeRange): Partial<SensorSeriesParams> {
  switch (range) {
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
  }
}

/** Merge page filters with the chart range preset (chart range wins on time params). */
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

  delete next.interval;
  if (rangeParams.interval) next.interval = rangeParams.interval;

  return next;
}

export function formatAxisTimeForRange(ts: unknown, range: ChartTimeRange): string {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n)) return String(ts ?? "");

  const date = new Date(n);

  if (range === "1y") {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  if (range === "30d" || range === "7d") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: range === "7d" ? "2-digit" : undefined,
      minute: range === "7d" ? "2-digit" : undefined,
    });
  }

  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/** Base params for series/table requests (time range applied separately). */
export function seriesFiltersForRange(range: ChartTimeRange): SensorReadingsParams {
  return applyChartTimeRange({ timezone: "Africa/Addis_Ababa" }, range);
}

export function chartWindowTitle(range: ChartTimeRange): string {
  const titles: Record<ChartTimeRange, string> = {
    "6h": "6 Hours",
    "24h": "24 Hours",
    "7d": "7 Days",
    "30d": "30 Days",
    "1y": "1 Year",
  };
  return titles[range];
}
