import { apiRequest, apiBlobRequest, DownloadedFile } from './client';
import { dedupeAsync } from './dedupe';
import {
  SensorReading,
  SensorReadingsResponse,
  SensorReadingsPaginatedResponse,
  CreateSensorReadingRequest,
  SensorReadingsParams,
  SensorSeriesParams,
  SeriesResponse,
  PublicReadingKPI,
} from './types';

export type { PublicReadingKPI };

// Get all sensor readings (authenticated endpoint) with comprehensive filtering
export async function getSensorReadings(params?: SensorReadingsParams & { requireAuth?: boolean }): Promise<SensorReading[]> {
  // Extract requireAuth before building query params
  const requireAuth = params?.requireAuth !== undefined ? params.requireAuth : true;
  const { requireAuth: _, ...filterParams } = params || {};
  
  const queryParams = new URLSearchParams();
  
  // Device/Location Filters
  if (filterParams?.device_id) queryParams.append('device_id', filterParams.device_id);
  // Array params: OpenAPI expects repeated keys (device_ids=id1&device_ids=id2) for FastAPI List[] query params
  if (filterParams?.device_ids && filterParams.device_ids.length > 0) {
    filterParams.device_ids.forEach(id => queryParams.append('device_ids', id));
  }
  if (filterParams?.location_id) queryParams.append('location_id', filterParams.location_id);
  if (filterParams?.location_ids && filterParams.location_ids.length > 0) {
    filterParams.location_ids.forEach(id => queryParams.append('location_ids', id));
  }
  if (filterParams?.serial_number) queryParams.append('serial_number', filterParams.serial_number);
  if (filterParams?.serial_numbers && filterParams.serial_numbers.length > 0) {
    filterParams.serial_numbers.forEach(sn => queryParams.append('serial_numbers', sn));
  }
  if (filterParams?.device_status) queryParams.append('device_status', filterParams.device_status);
  if (filterParams?.device_statuses && filterParams.device_statuses.length > 0) {
    filterParams.device_statuses.forEach(status => queryParams.append('device_statuses', status));
  }
  
  // Time Filters
  if (filterParams?.start_date) queryParams.append('start_date', filterParams.start_date);
  if (filterParams?.end_date) queryParams.append('end_date', filterParams.end_date);
  if (filterParams?.recorded_after) queryParams.append('recorded_after', filterParams.recorded_after);
  if (filterParams?.recorded_before) queryParams.append('recorded_before', filterParams.recorded_before);
  if (filterParams?.hours !== undefined) queryParams.append('hours', filterParams.hours.toString());
  if (filterParams?.days !== undefined) queryParams.append('days', filterParams.days.toString());
  if (filterParams?.recorded_date) queryParams.append('recorded_date', filterParams.recorded_date);
  if (filterParams?.today !== undefined) queryParams.append('today', filterParams.today.toString());
  if (filterParams?.yesterday !== undefined) queryParams.append('yesterday', filterParams.yesterday.toString());
  if (filterParams?.this_week !== undefined) queryParams.append('this_week', filterParams.this_week.toString());
  if (filterParams?.this_month !== undefined) queryParams.append('this_month', filterParams.this_month.toString());
  if (filterParams?.timezone) queryParams.append('timezone', filterParams.timezone);

  // Value Range Filters
  if (filterParams?.pm2_5_min !== undefined) queryParams.append('pm2_5_min', filterParams.pm2_5_min.toString());
  if (filterParams?.pm2_5_max !== undefined) queryParams.append('pm2_5_max', filterParams.pm2_5_max.toString());
  if (filterParams?.pm10_min !== undefined) queryParams.append('pm10_min', filterParams.pm10_min.toString());
  if (filterParams?.pm10_max !== undefined) queryParams.append('pm10_max', filterParams.pm10_max.toString());
  if (filterParams?.temperature_min !== undefined) queryParams.append('temperature_min', filterParams.temperature_min.toString());
  if (filterParams?.temperature_max !== undefined) queryParams.append('temperature_max', filterParams.temperature_max.toString());
  if (filterParams?.humidity_min !== undefined) queryParams.append('humidity_min', filterParams.humidity_min.toString());
  if (filterParams?.humidity_max !== undefined) queryParams.append('humidity_max', filterParams.humidity_max.toString());
  if (filterParams?.voc_index_min !== undefined) queryParams.append('voc_index_min', filterParams.voc_index_min.toString());
  if (filterParams?.voc_index_max !== undefined) queryParams.append('voc_index_max', filterParams.voc_index_max.toString());
  if (filterParams?.nox_index_min !== undefined) queryParams.append('nox_index_min', filterParams.nox_index_min.toString());
  if (filterParams?.nox_index_max !== undefined) queryParams.append('nox_index_max', filterParams.nox_index_max.toString());
  
  // Data Quality Filters
  if (filterParams?.has_pm2_5 !== undefined) queryParams.append('has_pm2_5', filterParams.has_pm2_5.toString());
  if (filterParams?.has_pm10 !== undefined) queryParams.append('has_pm10', filterParams.has_pm10.toString());
  if (filterParams?.has_temperature !== undefined) queryParams.append('has_temperature', filterParams.has_temperature.toString());
  if (filterParams?.has_humidity !== undefined) queryParams.append('has_humidity', filterParams.has_humidity.toString());
  if (filterParams?.has_voc_index !== undefined) queryParams.append('has_voc_index', filterParams.has_voc_index.toString());
  if (filterParams?.has_nox_index !== undefined) queryParams.append('has_nox_index', filterParams.has_nox_index.toString());
  if (filterParams?.has_all_readings !== undefined) queryParams.append('has_all_readings', filterParams.has_all_readings.toString());
  if (filterParams?.min_readings_count !== undefined) queryParams.append('min_readings_count', filterParams.min_readings_count.toString());
  
  // Pagination & Sorting
  if (filterParams?.offset !== undefined) queryParams.append('offset', filterParams.offset.toString());
  if (filterParams?.page !== undefined) queryParams.append('page', filterParams.page.toString());
  if (filterParams?.page_size !== undefined) queryParams.append('page_size', filterParams.page_size.toString());
  if (filterParams?.paginate) queryParams.append('paginate', filterParams.paginate);
  if (filterParams?.cursor) queryParams.append('cursor', filterParams.cursor);
  // Limit: API default 100, max 1000 - only send if valid
  if (filterParams?.limit !== undefined && filterParams.limit >= 1 && filterParams.limit <= 1000) {
    queryParams.append('limit', filterParams.limit.toString());
  }
  if (filterParams?.order_by) queryParams.append('order_by', filterParams.order_by);
  if (filterParams?.order) queryParams.append('order', filterParams.order);
  
  // Response Enhancements
  if (filterParams?.include_stats !== undefined) queryParams.append('include_stats', filterParams.include_stats.toString());
  if (filterParams?.include_device_info !== undefined) queryParams.append('include_device_info', filterParams.include_device_info.toString());
  if (filterParams?.include_location_info !== undefined) queryParams.append('include_location_info', filterParams.include_location_info.toString());
  
  // Aggregation
  if (filterParams?.group_by) queryParams.append('group_by', filterParams.group_by);
  if (filterParams?.aggregate) queryParams.append('aggregate', filterParams.aggregate);
  if (filterParams?.interval) queryParams.append('interval', filterParams.interval);

  const query = queryParams.toString();
  const endpoint = `/sensor-readings/${query ? `?${query}` : ''}`;
  
  const response = await apiRequest<SensorReading[] | SensorReadingsResponse>(endpoint, {
    requireAuth,
  });
  
  // Handle both array and object with data property
  if (Array.isArray(response)) {
    return response;
  }
  // If response is an object with data property (when include_stats is true)
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as SensorReadingsResponse).data || [];
  }
  return [];
}

function appendSeriesQueryParams(queryParams: URLSearchParams, params: SensorSeriesParams): void {
  if (params.device_id) queryParams.append('device_id', params.device_id);
  if (params.device_ids?.length) {
    params.device_ids.forEach((id) => queryParams.append('device_ids', id));
  }
  if (params.location_id) queryParams.append('location_id', params.location_id);
  if (params.hours !== undefined) queryParams.append('hours', params.hours.toString());
  if (params.days !== undefined) queryParams.append('days', params.days.toString());
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  if (params.interval) queryParams.append('interval', params.interval);
  if (params.timezone) queryParams.append('timezone', params.timezone);
  if (params.fill_gaps !== undefined) queryParams.append('fill_gaps', params.fill_gaps.toString());
  if (params.metrics?.length) {
    params.metrics.forEach((metric) => queryParams.append('metrics', metric));
  }
}

/** Pre-aggregated time buckets for charts (~1440 points for 24h at 1m default). */
export async function getSensorReadingsSeries(params: SensorSeriesParams): Promise<SeriesResponse> {
  const queryParams = new URLSearchParams();
  appendSeriesQueryParams(queryParams, params);
  const query = queryParams.toString();
  const endpoint = `/sensor-readings/series${query ? `?${query}` : ''}`;

  return dedupeAsync(
    endpoint,
    () =>
      apiRequest<SeriesResponse>(endpoint, {
        requireAuth: true,
      }),
    30_000
  );
}

/** Single page of raw readings with cursor pagination. */
export async function getSensorReadingsPaginated(
  params?: SensorReadingsParams
): Promise<SensorReadingsPaginatedResponse> {
  const queryParams = new URLSearchParams();
  const filterParams = params ?? {};

  if (filterParams.device_id) queryParams.append('device_id', filterParams.device_id);
  if (filterParams.device_ids?.length) {
    filterParams.device_ids.forEach((id) => queryParams.append('device_ids', id));
  }
  if (filterParams.location_id) queryParams.append('location_id', filterParams.location_id);
  if (filterParams.start_date) queryParams.append('start_date', filterParams.start_date);
  if (filterParams.end_date) queryParams.append('end_date', filterParams.end_date);
  if (filterParams.hours !== undefined) queryParams.append('hours', filterParams.hours.toString());
  if (filterParams.days !== undefined) queryParams.append('days', filterParams.days.toString());
  if (filterParams.recorded_date) queryParams.append('recorded_date', filterParams.recorded_date);
  if (filterParams.today !== undefined) queryParams.append('today', filterParams.today.toString());
  if (filterParams.yesterday !== undefined) queryParams.append('yesterday', filterParams.yesterday.toString());
  if (filterParams.this_week !== undefined) queryParams.append('this_week', filterParams.this_week.toString());
  if (filterParams.this_month !== undefined) queryParams.append('this_month', filterParams.this_month.toString());
  if (filterParams.timezone) queryParams.append('timezone', filterParams.timezone);
  if (filterParams.order_by) queryParams.append('order_by', filterParams.order_by);
  if (filterParams.order) queryParams.append('order', filterParams.order);
  if (filterParams.include_stats !== undefined) {
    queryParams.append('include_stats', filterParams.include_stats.toString());
  }
  queryParams.append('paginate', 'cursor');
  if (filterParams.cursor) queryParams.append('cursor', filterParams.cursor);
  const limit = filterParams.limit !== undefined && filterParams.limit >= 1 && filterParams.limit <= 1000
    ? filterParams.limit
    : 1000;
  queryParams.append('limit', limit.toString());

  const query = queryParams.toString();
  const endpoint = `/sensor-readings/?${query}`;

  return apiRequest<SensorReadingsPaginatedResponse>(endpoint, {
    requireAuth: true,
  });
}

export interface SensorReadingsExportParams {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  location_ids?: string[];
  serial_number?: string;
  serial_numbers?: string[];
  device_status?: string;
  device_statuses?: string[];
  start_date?: string;
  end_date?: string;
  recorded_after?: string;
  recorded_before?: string;
  hours?: number;
  days?: number;
  recorded_date?: string;
  today?: boolean;
  yesterday?: boolean;
  this_week?: boolean;
  this_month?: boolean;
  timezone?: string;
  pm2_5_min?: number;
  pm2_5_max?: number;
  pm10_min?: number;
  pm10_max?: number;
  temperature_min?: number;
  temperature_max?: number;
  humidity_min?: number;
  humidity_max?: number;
  voc_index_min?: number;
  voc_index_max?: number;
  nox_index_min?: number;
  nox_index_max?: number;
  has_pm2_5?: boolean;
  has_pm10?: boolean;
  has_temperature?: boolean;
  has_humidity?: boolean;
  has_voc_index?: boolean;
  has_nox_index?: boolean;
  has_all_readings?: boolean;
  min_readings_count?: number;
  order_by?: string;
  order?: string;
  include_device_info?: boolean;
  include_location_info?: boolean;
  limit?: number;
}

function buildExportQueryParams(params?: SensorReadingsExportParams): URLSearchParams {
  const queryParams = new URLSearchParams();
  if (!params) {
    queryParams.append('limit', '100000');
    return queryParams;
  }

  if (params.device_id) queryParams.append('device_id', params.device_id);
  if (params.device_ids?.length) {
    params.device_ids.forEach((id) => queryParams.append('device_ids', id));
  }
  if (params.location_id) queryParams.append('location_id', params.location_id);
  if (params.location_ids?.length) {
    params.location_ids.forEach((id) => queryParams.append('location_ids', id));
  }
  if (params.serial_number) queryParams.append('serial_number', params.serial_number);
  if (params.serial_numbers?.length) {
    params.serial_numbers.forEach((sn) => queryParams.append('serial_numbers', sn));
  }
  if (params.device_status) queryParams.append('device_status', params.device_status);
  if (params.device_statuses?.length) {
    params.device_statuses.forEach((status) => queryParams.append('device_statuses', status));
  }

  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  if (params.recorded_after) queryParams.append('recorded_after', params.recorded_after);
  if (params.recorded_before) queryParams.append('recorded_before', params.recorded_before);
  if (params.hours !== undefined && params.hours !== null) queryParams.append('hours', params.hours.toString());
  if (params.days !== undefined && params.days !== null) queryParams.append('days', params.days.toString());
  if (params.recorded_date) queryParams.append('recorded_date', params.recorded_date);
  if (params.today !== undefined && params.today !== null) queryParams.append('today', params.today.toString());
  if (params.yesterday !== undefined && params.yesterday !== null) queryParams.append('yesterday', params.yesterday.toString());
  if (params.this_week !== undefined && params.this_week !== null) queryParams.append('this_week', params.this_week.toString());
  if (params.this_month !== undefined && params.this_month !== null) queryParams.append('this_month', params.this_month.toString());
  if (params.timezone) queryParams.append('timezone', params.timezone);

  if (params.pm2_5_min !== undefined && params.pm2_5_min !== null) queryParams.append('pm2_5_min', params.pm2_5_min.toString());
  if (params.pm2_5_max !== undefined && params.pm2_5_max !== null) queryParams.append('pm2_5_max', params.pm2_5_max.toString());
  if (params.pm10_min !== undefined && params.pm10_min !== null) queryParams.append('pm10_min', params.pm10_min.toString());
  if (params.pm10_max !== undefined && params.pm10_max !== null) queryParams.append('pm10_max', params.pm10_max.toString());
  if (params.temperature_min !== undefined && params.temperature_min !== null) queryParams.append('temperature_min', params.temperature_min.toString());
  if (params.temperature_max !== undefined && params.temperature_max !== null) queryParams.append('temperature_max', params.temperature_max.toString());
  if (params.humidity_min !== undefined && params.humidity_min !== null) queryParams.append('humidity_min', params.humidity_min.toString());
  if (params.humidity_max !== undefined && params.humidity_max !== null) queryParams.append('humidity_max', params.humidity_max.toString());
  if (params.voc_index_min !== undefined && params.voc_index_min !== null) queryParams.append('voc_index_min', params.voc_index_min.toString());
  if (params.voc_index_max !== undefined && params.voc_index_max !== null) queryParams.append('voc_index_max', params.voc_index_max.toString());
  if (params.nox_index_min !== undefined && params.nox_index_min !== null) queryParams.append('nox_index_min', params.nox_index_min.toString());
  if (params.nox_index_max !== undefined && params.nox_index_max !== null) queryParams.append('nox_index_max', params.nox_index_max.toString());

  if (params.has_pm2_5 !== undefined && params.has_pm2_5 !== null) queryParams.append('has_pm2_5', params.has_pm2_5.toString());
  if (params.has_pm10 !== undefined && params.has_pm10 !== null) queryParams.append('has_pm10', params.has_pm10.toString());
  if (params.has_temperature !== undefined && params.has_temperature !== null) queryParams.append('has_temperature', params.has_temperature.toString());
  if (params.has_humidity !== undefined && params.has_humidity !== null) queryParams.append('has_humidity', params.has_humidity.toString());
  if (params.has_voc_index !== undefined && params.has_voc_index !== null) queryParams.append('has_voc_index', params.has_voc_index.toString());
  if (params.has_nox_index !== undefined && params.has_nox_index !== null) queryParams.append('has_nox_index', params.has_nox_index.toString());
  if (params.has_all_readings !== undefined && params.has_all_readings !== null) queryParams.append('has_all_readings', params.has_all_readings.toString());
  if (params.min_readings_count !== undefined && params.min_readings_count !== null) queryParams.append('min_readings_count', params.min_readings_count.toString());

  if (params.order_by) queryParams.append('order_by', params.order_by);
  if (params.order) queryParams.append('order', params.order);

  if (params.include_device_info !== undefined && params.include_device_info !== null) {
    queryParams.append('include_device_info', params.include_device_info.toString());
  }
  if (params.include_location_info !== undefined && params.include_location_info !== null) {
    queryParams.append('include_location_info', params.include_location_info.toString());
  }

  const limit = params.limit !== undefined && params.limit !== null && params.limit >= 1 && params.limit <= 100_000
    ? params.limit
    : 100_000;
  queryParams.append('limit', limit.toString());

  return queryParams;
}

export async function exportSensorReadingsCsv(
  params?: SensorReadingsExportParams
): Promise<DownloadedFile> {
  const queryParams = buildExportQueryParams(params);
  const query = queryParams.toString();
  const endpoint = `/sensor-readings/export/csv${query ? `?${query}` : ''}`;
  return apiBlobRequest(endpoint, { requireAuth: true });
}

export async function exportSensorReadingsExcel(
  params?: SensorReadingsExportParams
): Promise<DownloadedFile> {
  const queryParams = buildExportQueryParams(params);
  const query = queryParams.toString();
  const endpoint = `/sensor-readings/export/excel${query ? `?${query}` : ''}`;
  return apiBlobRequest(endpoint, { requireAuth: true });
}

// Get sensor reading by ID (authenticated endpoint)
export async function getSensorReadingById(readingId: string): Promise<SensorReading> {
  return apiRequest<SensorReading>(`/sensor-readings/${readingId}`, {
    requireAuth: true, // This endpoint requires authentication
  });
}

// Create sensor reading (authenticated)
// POST /api/v1/sensor-readings/
export async function createSensorReading(data: CreateSensorReadingRequest): Promise<SensorReading> {
  return apiRequest<SensorReading>('/sensor-readings/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Create bulk sensor readings (authenticated)
export async function createBulkSensorReadings(readings: CreateSensorReadingRequest[]): Promise<SensorReading[]> {
  return apiRequest<SensorReading[]>('/sensor-readings/bulk', {
    method: 'POST',
    body: JSON.stringify(readings),
  });
}

/** @deprecated Use PublicReadingKPI — slim KPI without embedded location or VOC/NOx */
export type KPIMapReading = PublicReadingKPI;

async function fetchLatestKPIs(params?: {
  location_id?: string;
  device_id?: string;
  today_only?: boolean;
}): Promise<PublicReadingKPI[]> {
  const queryParams = new URLSearchParams();

  if (params?.location_id) {
    queryParams.append('location_id', params.location_id);
  }
  if (params?.device_id) {
    queryParams.append('device_id', params.device_id);
  }
  if (params?.today_only !== undefined) {
    queryParams.append('today_only', params.today_only.toString());
  }

  const query = queryParams.toString();
  const endpoint = `/sensor-readings/latest${query ? `?${query}` : ''}`;
  const cacheKey = endpoint;

  return dedupeAsync(cacheKey, () =>
    apiRequest<PublicReadingKPI[]>(endpoint, {
      requireAuth: false,
    })
  );
}

/** Latest public KPIs — join with GET /locations for map coordinates */
export async function getLatestKPIs(params?: {
  location_id?: string;
  device_id?: string;
  today_only?: boolean;
}): Promise<PublicReadingKPI[]> {
  return fetchLatestKPIs(params);
}

/** Alias for getLatestKPIs — /kpi-map returns the same response shape */
export async function getKPIMapData(params?: {
  location_id?: string;
  device_id?: string;
  today_only?: boolean;
}): Promise<PublicReadingKPI[]> {
  return fetchLatestKPIs(params);
}
