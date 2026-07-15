import { apiRequest } from './client';

export type AnalyticsMetric =
  | 'pm2_5'
  | 'pm10'
  | 'temperature'
  | 'humidity'
  | 'voc_index'
  | 'nox_index';

export type AnalyticsTrendInterval = 'hour' | 'day' | 'week' | 'month';
export type AnalyticsGroupBy = 'device' | 'location' | 'day' | 'week' | 'month';
export type AqiGroupBy = 'device' | 'location' | 'overall';
export type AqiCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for sensitive groups'
  | 'Unhealthy'
  | 'Very unhealthy'
  | 'Hazardous';

export interface AnalyticsDateRange {
  start_date?: string;
  end_date?: string;
  days?: number;
  timezone?: string;
}

function appendDateRangeParams(queryParams: URLSearchParams, params?: AnalyticsDateRange) {
  if (!params) return;
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  if (params.days !== undefined && params.days !== null) {
    queryParams.append('days', params.days.toString());
  }
  if (params.timezone) queryParams.append('timezone', params.timezone);
}

// ── 1. Trends ─────────────────────────────────────────────────────────────────

export interface AnalyticsTrendsParams extends AnalyticsDateRange {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  interval?: AnalyticsTrendInterval;
  metric?: AnalyticsMetric;
}

export interface AnalyticsTrendsDataPoint {
  time_period: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface AnalyticsTrendsResponse {
  metric: AnalyticsMetric;
  interval: AnalyticsTrendInterval;
  start_date: string;
  end_date: string;
  timezone: string;
  data: AnalyticsTrendsDataPoint[];
}

export async function getAnalyticsTrends(
  params?: AnalyticsTrendsParams
): Promise<AnalyticsTrendsResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    appendDateRangeParams(queryParams, params);
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.device_ids?.length) {
      params.device_ids.forEach((id) => queryParams.append('device_ids', id));
    }
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.interval) queryParams.append('interval', params.interval);
    if (params.metric) queryParams.append('metric', params.metric);
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsTrendsResponse>(`/analytics/trends${query ? `?${query}` : ''}`, {
    requireAuth: true,
  });
}

// ── 2. Statistics ─────────────────────────────────────────────────────────────

export interface AnalyticsStatisticsParams extends AnalyticsDateRange {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  group_by?: AnalyticsGroupBy;
}

export interface AnalyticsMetricStat {
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
  stddev: number | null;
}

export interface AnalyticsStatisticsGroupedRow {
  device_id?: string;
  serial_number?: string;
  location_id?: string | null;
  location_name?: string | null;
  time_period?: string;
  pm2_5: AnalyticsMetricStat;
  pm10: AnalyticsMetricStat;
  temperature: AnalyticsMetricStat;
  humidity: AnalyticsMetricStat;
  voc_index: AnalyticsMetricStat;
  nox_index: AnalyticsMetricStat;
}

export interface AnalyticsStatisticsGroupedResponse {
  group_by: AnalyticsGroupBy;
  start_date: string;
  end_date: string;
  timezone: string;
  data: AnalyticsStatisticsGroupedRow[];
}

export interface AnalyticsStatisticsOverallResponse {
  start_date: string;
  end_date: string;
  timezone: string;
  statistics: Record<AnalyticsMetric, AnalyticsMetricStat>;
}

export async function getAnalyticsStatistics(
  params?: AnalyticsStatisticsParams
): Promise<AnalyticsStatisticsGroupedResponse | AnalyticsStatisticsOverallResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    appendDateRangeParams(queryParams, params);
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.device_ids?.length) {
      params.device_ids.forEach((id) => queryParams.append('device_ids', id));
    }
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.group_by) queryParams.append('group_by', params.group_by);
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsStatisticsGroupedResponse | AnalyticsStatisticsOverallResponse>(
    `/analytics/statistics${query ? `?${query}` : ''}`,
    { requireAuth: true }
  );
}

// ── 3. Visualization ──────────────────────────────────────────────────────────

export interface AnalyticsVisualizationParams extends AnalyticsDateRange {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  interval?: 'hour' | 'day';
  metrics?: AnalyticsMetric[];
}

export interface AnalyticsVisualizationDataPoint {
  time_period: string;
  pm2_5?: number | null;
  pm10?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  voc_index?: number | null;
  nox_index?: number | null;
}

export interface AnalyticsVisualizationResponse {
  metrics: AnalyticsMetric[];
  interval: 'hour' | 'day';
  start_date: string;
  end_date: string;
  timezone: string;
  data: AnalyticsVisualizationDataPoint[];
}

export async function getAnalyticsVisualization(
  params?: AnalyticsVisualizationParams
): Promise<AnalyticsVisualizationResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    appendDateRangeParams(queryParams, params);
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.device_ids?.length) {
      params.device_ids.forEach((id) => queryParams.append('device_ids', id));
    }
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.interval) queryParams.append('interval', params.interval);
    if (params.metrics?.length) {
      params.metrics.forEach((m) => queryParams.append('metrics', m));
    }
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsVisualizationResponse>(
    `/analytics/visualization${query ? `?${query}` : ''}`,
    { requireAuth: true }
  );
}

// ── 4. Summary ────────────────────────────────────────────────────────────────

export interface AnalyticsSummaryParams extends AnalyticsDateRange {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
}

export interface AnalyticsMetricSummary {
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface AnalyticsSummaryResponse {
  start_date: string;
  end_date: string;
  timezone: string;
  total_readings: number;
  device_count: number;
  location_count: number;
  statistics: Record<AnalyticsMetric, AnalyticsMetricSummary>;
}

export async function getAnalyticsSummary(
  params?: AnalyticsSummaryParams
): Promise<AnalyticsSummaryResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    appendDateRangeParams(queryParams, params);
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.device_ids?.length) {
      params.device_ids.forEach((id) => queryParams.append('device_ids', id));
    }
    if (params.location_id) queryParams.append('location_id', params.location_id);
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsSummaryResponse>(`/analytics/summary${query ? `?${query}` : ''}`, {
    requireAuth: true,
  });
}

// ── 5. Air Quality Index ──────────────────────────────────────────────────────

export interface AnalyticsAqiParams extends AnalyticsDateRange {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  group_by?: AqiGroupBy;
}

export interface AnalyticsAqiDeviceRow {
  device_id: string;
  serial_number: string;
  location_id: string | null;
  location_name: string | null;
  pm2_5_avg: number | null;
  pm10_avg: number | null;
  aqi_category: AqiCategory | null;
  last_recorded_at: string | null;
}

export interface AnalyticsAqiLocationRow {
  location_id: string | null;
  location_name: string | null;
  pm2_5_avg: number | null;
  pm10_avg: number | null;
  aqi_category: AqiCategory | null;
  last_recorded_at: string | null;
}

export interface AnalyticsAqiOverallData {
  pm2_5_avg: number | null;
  pm10_avg: number | null;
  aqi_category: AqiCategory | null;
  last_recorded_at: string | null;
}

export interface AnalyticsAqiResponse {
  start_date: string;
  end_date: string;
  timezone: string;
  group_by: AqiGroupBy;
  data: AnalyticsAqiDeviceRow[] | AnalyticsAqiLocationRow[] | AnalyticsAqiOverallData;
}

export async function getAnalyticsAqi(
  params?: AnalyticsAqiParams
): Promise<AnalyticsAqiResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    appendDateRangeParams(queryParams, params);
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.device_ids?.length) {
      params.device_ids.forEach((id) => queryParams.append('device_ids', id));
    }
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.group_by) queryParams.append('group_by', params.group_by);
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsAqiResponse>(
    `/analytics/air-quality-index${query ? `?${query}` : ''}`,
    { requireAuth: true }
  );
}

// ── 6. Exceedances ────────────────────────────────────────────────────────────

export interface AnalyticsExceedancesParams extends AnalyticsDateRange {
  metric?: AnalyticsMetric;
  threshold?: number;
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  return_samples?: boolean;
  max_samples?: number;
}

export interface AnalyticsExceedanceSample {
  reading_id: string;
  device_id: string;
  recorded_at: string;
  value: number | null;
}

export interface AnalyticsExceedancesResponse {
  metric: AnalyticsMetric;
  threshold: number;
  start_date: string;
  end_date: string;
  timezone: string;
  exceedance_count: number;
  samples: AnalyticsExceedanceSample[];
}

export async function getAnalyticsExceedances(
  params?: AnalyticsExceedancesParams
): Promise<AnalyticsExceedancesResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    appendDateRangeParams(queryParams, params);
    if (params.metric) queryParams.append('metric', params.metric);
    if (params.threshold !== undefined && params.threshold !== null) {
      queryParams.append('threshold', params.threshold.toString());
    }
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.device_ids?.length) {
      params.device_ids.forEach((id) => queryParams.append('device_ids', id));
    }
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.return_samples !== undefined && params.return_samples !== null) {
      queryParams.append('return_samples', params.return_samples.toString());
    }
    if (params.max_samples !== undefined && params.max_samples !== null) {
      queryParams.append('max_samples', params.max_samples.toString());
    }
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsExceedancesResponse>(
    `/analytics/exceedances${query ? `?${query}` : ''}`,
    { requireAuth: true }
  );
}

// ── 7. Percentiles ────────────────────────────────────────────────────────────

export interface AnalyticsPercentilesParams extends AnalyticsDateRange {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  metrics?: AnalyticsMetric[];
  percentiles?: number[];
}

export interface AnalyticsPercentilesResponse {
  start_date: string;
  end_date: string;
  timezone: string;
  percentiles: string[];
  metrics: Record<AnalyticsMetric, Record<string, number | null>>;
}

export async function getAnalyticsPercentiles(
  params?: AnalyticsPercentilesParams
): Promise<AnalyticsPercentilesResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    appendDateRangeParams(queryParams, params);
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.device_ids?.length) {
      params.device_ids.forEach((id) => queryParams.append('device_ids', id));
    }
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.metrics?.length) {
      params.metrics.forEach((m) => queryParams.append('metrics', m));
    }
    if (params.percentiles?.length) {
      params.percentiles.forEach((p) => queryParams.append('percentiles', p.toString()));
    }
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsPercentilesResponse>(
    `/analytics/percentiles${query ? `?${query}` : ''}`,
    { requireAuth: true }
  );
}

// ── 8. Latest ─────────────────────────────────────────────────────────────────

export interface AnalyticsLatestParams {
  device_id?: string;
  location_id?: string;
  today_only?: boolean;
}

export interface AnalyticsLatestKpi {
  device_id: string;
  serial_number: string;
  location_id: string | null;
  pm2_5: number | null;
  pm10: number | null;
  humidity: number | null;
  temperature: number | null;
  air_quality_level: string | null;
  recorded_at: string;
}

export type AnalyticsLatestResponse = AnalyticsLatestKpi[];

export async function getAnalyticsLatest(
  params?: AnalyticsLatestParams
): Promise<AnalyticsLatestResponse> {
  const queryParams = new URLSearchParams();
  if (params) {
    if (params.device_id) queryParams.append('device_id', params.device_id);
    if (params.location_id) queryParams.append('location_id', params.location_id);
    if (params.today_only !== undefined && params.today_only !== null) {
      queryParams.append('today_only', params.today_only.toString());
    }
  }
  const query = queryParams.toString();
  return apiRequest<AnalyticsLatestResponse>(`/analytics/latest${query ? `?${query}` : ''}`, {
    requireAuth: true,
  });
}
