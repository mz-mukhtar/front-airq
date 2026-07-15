import { getSensorReadingsSeries } from "@/lib/api/sensor-readings";
import {
  SensorReading,
  SensorReadingsParams,
  SensorSeriesParams,
  SeriesBucket,
  SeriesMeta,
  SeriesResponse,
} from "@/lib/api/types";
import { normalizeSensorTimeFilters, pickTimeFilters } from "@/lib/utils/sensor-filters";

export const DEFAULT_SENSOR_HOURS = 24;
export const DEFAULT_SENSOR_TIMEZONE = "Africa/Addis_Ababa";

export function groupSeriesByDevice(series: SeriesBucket[]): Record<string, SeriesBucket[]> {
  const grouped: Record<string, SeriesBucket[]> = {};

  for (const bucket of series) {
    if (!grouped[bucket.device_id]) grouped[bucket.device_id] = [];
    grouped[bucket.device_id].push(bucket);
  }

  for (const deviceId of Object.keys(grouped)) {
    grouped[deviceId].sort(
      (a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime()
    );
  }

  return grouped;
}

/** Convert aggregated bucket to a reading-shaped object for existing chart/table helpers. */
export function bucketToReading(bucket: SeriesBucket): SensorReading {
  return {
    id: `${bucket.device_id}-${bucket.bucket_start}`,
    device_id: bucket.device_id,
    pm2_5: bucket.pm2_5?.avg ?? undefined,
    pm10: bucket.pm10?.avg ?? undefined,
    temperature: bucket.temperature?.avg ?? undefined,
    humidity: bucket.humidity?.avg ?? undefined,
    voc_index: bucket.voc_index?.avg ?? undefined,
    nox_index: bucket.nox_index?.avg ?? undefined,
    recorded_at: bucket.bucket_start,
    created_at: bucket.bucket_start,
  };
}

export function bucketsToReadings(buckets: SeriesBucket[]): SensorReading[] {
  return buckets.map(bucketToReading);
}

/** Human-readable label for chart subtitle / tooltips. */
export function formatSeriesMetaLabel(meta: SeriesMeta | null): string | null {
  if (!meta?.window?.start || !meta?.window?.end) return null;

  const intervalLabels: Record<string, string> = {
    auto: "1-minute averages",
    "1m": "1-minute averages",
    "5m": "5-minute averages",
    "15m": "15-minute averages",
    "1h": "hourly averages",
    "1d": "daily averages",
  };
  const intervalLabel = intervalLabels[meta.interval] ?? `${meta.interval} averages`;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return `${meta.bucket_count} points · ${intervalLabel} · ${fmt(meta.window.start)} – ${fmt(meta.window.end)}`;
}

/** Start of the local day for a given date, as ISO string. */
function startOfDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * The series endpoint only supports hours/days/start_date/end_date, so map
 * quick filters (today/yesterday/this_week/this_month/recorded_date) to
 * explicit date windows instead of dropping them.
 */
function quickFiltersToDateWindow(
  time: SensorReadingsParams
): { start_date?: string; end_date?: string } {
  const now = new Date();

  if (time.recorded_date) {
    const start = new Date(`${time.recorded_date}T00:00:00`);
    if (!isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start_date: start.toISOString(), end_date: end.toISOString() };
    }
  }
  if (time.today) {
    return { start_date: startOfDayIso(now) };
  }
  if (time.yesterday) {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    return { start_date: startOfDayIso(start), end_date: startOfDayIso(now) };
  }
  if (time.this_week) {
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day + 6) % 7; // Monday as start of week
    start.setDate(start.getDate() - diff);
    return { start_date: startOfDayIso(start) };
  }
  if (time.this_month) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start_date: start.toISOString() };
  }
  return {};
}

export function filtersToSeriesParams(
  filters: SensorReadingsParams,
  deviceIds: string[]
): SensorSeriesParams {
  const normalized = normalizeSensorTimeFilters(filters);
  const time = pickTimeFilters(normalized);

  const params: SensorSeriesParams = {
    fill_gaps: true,
    timezone: time.timezone ?? DEFAULT_SENSOR_TIMEZONE,
  };

  if (normalized.location_id && deviceIds.length === 0) {
    params.location_id = normalized.location_id;
  } else if (deviceIds.length === 1) {
    params.device_id = deviceIds[0];
  } else if (deviceIds.length > 1) {
    params.device_ids = deviceIds;
  } else if (normalized.device_id) {
    params.device_id = normalized.device_id;
  } else if (normalized.device_ids?.length) {
    params.device_ids = normalized.device_ids;
  }

  if (time.hours !== undefined) params.hours = time.hours;
  if (time.days !== undefined) params.days = time.days;
  if (time.start_date) params.start_date = time.start_date;
  if (time.end_date) params.end_date = time.end_date;

  // Map quick filters (unsupported by /series) to explicit date windows
  if (!params.start_date && !params.end_date) {
    const window = quickFiltersToDateWindow(time);
    if (window.start_date) params.start_date = window.start_date;
    if (window.end_date) params.end_date = window.end_date;
  }

  if (normalized.interval) {
    params.interval = normalized.interval as SensorSeriesParams["interval"];
  }

  if (
    params.hours === undefined &&
    params.days === undefined &&
    !params.start_date &&
    !params.end_date
  ) {
    params.hours = DEFAULT_SENSOR_HOURS;
  }

  return params;
}

export function filtersToRawParams(
  filters: SensorReadingsParams,
  deviceIds: string[]
): SensorReadingsParams {
  const normalized = normalizeSensorTimeFilters(filters);
  const time = pickTimeFilters(normalized);

  const params: SensorReadingsParams = {
    ...time,
    timezone: time.timezone ?? DEFAULT_SENSOR_TIMEZONE,
    order_by: "recorded_at",
    order: "asc",
    paginate: "cursor",
  };

  if (deviceIds.length === 1) {
    params.device_id = deviceIds[0];
  } else if (deviceIds.length > 1) {
    params.device_ids = deviceIds;
  } else if (normalized.device_id) {
    params.device_id = normalized.device_id;
  } else if (normalized.device_ids?.length) {
    params.device_ids = normalized.device_ids;
  } else if (normalized.location_id) {
    params.location_id = normalized.location_id;
  }

  if (
    params.hours === undefined &&
    params.days === undefined &&
    !params.start_date &&
    !params.end_date &&
    !params.today &&
    !params.yesterday &&
    !params.this_week &&
    !params.this_month &&
    !params.recorded_date
  ) {
    params.hours = DEFAULT_SENSOR_HOURS;
  }

  return params;
}

/** Fetch chart series for one or many devices (single API request). */
export async function fetchChartSeries(
  filters: SensorReadingsParams,
  deviceIds: string[]
): Promise<SeriesResponse> {
  if (deviceIds.length === 0 && !filters.location_id) {
    return {
      meta: {
        timezone: DEFAULT_SENSOR_TIMEZONE,
        interval: "1m",
        interval_seconds: 60,
        window: { start: "", end: "" },
        device_count: 0,
        bucket_count: 0,
        last_seen_at: null,
      },
      series: [],
    };
  }

  const params = filtersToSeriesParams(filters, deviceIds);

  // getSensorReadingsSeries dedupes internally — no extra cache layer here.
  let response = await getSensorReadingsSeries(params);

  // If a "today" window has no data yet, fall back to a rolling 24h window
  if (response.series.length === 0 && filters.today) {
    const rolling: SensorSeriesParams = { ...params, hours: DEFAULT_SENSOR_HOURS };
    delete rolling.start_date;
    delete rolling.end_date;
    response = await getSensorReadingsSeries(rolling);
  }

  return response;
}

export interface LatestSeriesMetrics {
  pm2_5: number;
  pm10: number;
  temperature: number;
  humidity: number;
  voc: number;
  nox: number;
  recorded_at: string | null;
}

/** Latest values from the most recent non-empty bucket. */
export function latestMetricsFromBuckets(buckets: SeriesBucket[]): LatestSeriesMetrics {
  const sorted = [...buckets].sort(
    (a, b) => new Date(b.bucket_start).getTime() - new Date(a.bucket_start).getTime()
  );

  for (const bucket of sorted) {
    if (bucket.sample_count === 0) continue;

    return {
      pm2_5: bucket.pm2_5?.avg ?? 0,
      pm10: bucket.pm10?.avg ?? 0,
      temperature: bucket.temperature?.avg ?? 0,
      humidity: bucket.humidity?.avg ?? 0,
      voc: bucket.voc_index?.avg ?? 0,
      nox: bucket.nox_index?.avg ?? 0,
      recorded_at: bucket.bucket_start,
    };
  }

  return {
    pm2_5: 0,
    pm10: 0,
    temperature: 0,
    humidity: 0,
    voc: 0,
    nox: 0,
    recorded_at: null,
  };
}

/** Convert already-grouped series buckets to reading-shaped arrays per device. */
export function seriesReadingsByDevice(
  grouped: Record<string, SeriesBucket[]>
): Record<string, SensorReading[]> {
  const result: Record<string, SensorReading[]> = {};

  for (const [deviceId, buckets] of Object.entries(grouped)) {
    result[deviceId] = bucketsToReadings(buckets);
  }

  return result;
}

export type { SeriesMeta, SeriesResponse };
