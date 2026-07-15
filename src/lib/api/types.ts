// API Types matching the backend models

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** Public KPI from GET /sensor-readings/latest (same shape as /kpi-map) */
export interface PublicReadingKPI {
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

export interface SensorDevice {
  id: string;
  location_id: string;
  who_deployed_it: 'source' | 'custom';
  serial_number: string;
  status: 'active' | 'offline' | 'maintenance';
  /** Admin-only: omitted in the public (anonymous/non-admin) projection. */
  approval_status?: 'pending' | 'approved' | 'rejected';
  /** Masked metadata: last 4 chars of the current device API key. */
  api_key_last4?: string | null;
  owner_id?: string | null;
  approved_by?: string | null;
  installed_at: string;
  created_at: string;
  metadata_json?: Record<string, any>;
}

/** Response from POST /sensor-devices/ — includes the one-time plaintext API key. */
export interface SensorDeviceCreateResponse extends SensorDevice {
  api_key: string;
}

export interface SensorReading {
  id: string;
  device_id: string;
  serial_number?: string;
  pm1_0?: number;
  pm2_5?: number;
  pm4_0?: number;
  pm10?: number;
  nc0_5?: number;
  nc1_0?: number;
  nc2_5?: number;
  nc4_0?: number;
  nc10_0?: number;
  typical_particle_size?: number;
  temperature?: number;
  humidity?: number;
  voc_index?: number;
  nox_index?: number;
  recorded_at: string;
  created_at: string;
  reading_value?: Record<string, any>; // Legacy support (still read defensively in lib/utils/readings.ts)
  device?: SensorDevice; // When include_device_info=true
  location?: Location; // When include_location_info=true
}

export interface SensorReadingsResponse {
  data?: SensorReading[];
  stats?: {
    pm1_0?: { min: number; max: number; avg: number; count: number };
    pm2_5?: { min: number; max: number; avg: number; count: number };
    pm4_0?: { min: number; max: number; avg: number; count: number };
    pm10?: { min: number; max: number; avg: number; count: number };
    temperature?: { min: number; max: number; avg: number; count: number };
    humidity?: { min: number; max: number; avg: number; count: number };
    voc_index?: { min: number; max: number; avg: number; count: number };
    nox_index?: { min: number; max: number; avg: number; count: number };
  };
  count?: number;
}

export interface MetricStats {
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface SeriesBucket {
  bucket_start: string;
  bucket_end: string;
  device_id: string;
  location_id: string | null;
  pm2_5: MetricStats | null;
  pm10: MetricStats | null;
  temperature: MetricStats | null;
  humidity: MetricStats | null;
  voc_index: MetricStats | null;
  nox_index: MetricStats | null;
  sample_count: number;
  expected_count: number;
  coverage_pct: number;
}

export interface SeriesMeta {
  timezone: string;
  interval: string;
  interval_seconds: number;
  window: { start: string; end: string };
  device_count: number;
  bucket_count: number;
  last_seen_at: string | null;
}

export interface SeriesResponse {
  meta: SeriesMeta;
  series: SeriesBucket[];
}

export interface PaginationMeta {
  limit: number;
  has_more: boolean;
  next_cursor: string | null;
}

export interface SensorReadingsPaginatedResponse {
  data: SensorReading[];
  pagination: PaginationMeta;
  stats?: Record<string, { min: number; max: number; avg: number; count: number }>;
}

export type SeriesMetricKey =
  | 'pm2_5'
  | 'pm10'
  | 'temperature'
  | 'humidity'
  | 'voc_index'
  | 'nox_index';

export interface SensorSeriesParams {
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  hours?: number;
  days?: number;
  start_date?: string;
  end_date?: string;
  /** Omit for backend default (1m). Use 5m/15m/1h/1d for longer windows. `auto` is an alias for 1m. */
  interval?: 'auto' | '1m' | '5m' | '15m' | '1h' | '1d';
  timezone?: string;
  metrics?: SeriesMetricKey[];
  fill_gaps?: boolean;
}

// Request/Response types
export interface LoginRequest {
  username: string; // email
  password: string;
}

// The proxy strips access_token from auth responses (it lives in an httpOnly cookie)
export interface LoginResponse {
  token_type: string;
  expires_in?: number;
}

export interface RefreshTokenResponse {
  token_type: string;
  expires_in?: number;
}

export interface LogoutResponse {
  message: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface CreateLocationRequest {
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export interface UpdateLocationRequest {
  name?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}

export interface LocationDeleteConflictDetail {
  message: string;
  device_count: number;
  reading_count: number;
  requires_cascade: boolean;
}

export interface LocationDeleteSuccessResponse {
  message: string;
  cascaded?: boolean;
  devices_deleted?: number;
  readings_deleted?: number;
}

export interface CreateSensorDeviceRequest {
  location_id: string;
  who_deployed_it: 'source' | 'custom';
  serial_number: string;
  status?: 'active' | 'offline' | 'maintenance';
  metadata_json?: Record<string, any>;
}

export interface UpdateSensorDeviceRequest {
  location_id?: string;
  who_deployed_it?: 'source' | 'custom';
  serial_number?: string;
  status?: 'active' | 'offline' | 'maintenance';
  metadata_json?: Record<string, any>;
}

export interface CreateSensorReadingRequest {
  device_id: string;
  serial_number: string;
  pm1_0?: number;
  pm2_5?: number;
  pm4_0?: number;
  pm10?: number;
  nc0_5?: number;
  nc1_0?: number;
  nc2_5?: number;
  nc4_0?: number;
  nc10_0?: number;
  typical_particle_size?: number;
  humidity?: number;
  temperature?: number;
  voc_index?: number;
  nox_index?: number;
  recorded_at: string;
}

export interface BulkSensorReadingRequest extends CreateSensorReadingRequest {}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export interface UpdatePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface CreateAdminRequest {
  name: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface UpdateRoleRequest {
  user_id: string;
  new_role: 'admin' | 'user';
}

// User Management (Admin Only)
export interface UserAdminCreate {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface UserAdminUpdate {
  name?: string;
  email?: string;
  role?: 'admin' | 'user';
}

export interface ResetPasswordRequest {
  new_password: string;
}

// Query parameters
export interface PaginationParams {
  limit?: number;
}

export interface SensorReadingsParams extends PaginationParams {
  // Device/Location Filters
  device_id?: string;
  device_ids?: string[];
  location_id?: string;
  location_ids?: string[];
  serial_number?: string;
  serial_numbers?: string[];
  device_status?: 'active' | 'offline' | 'maintenance';
  device_statuses?: ('active' | 'offline' | 'maintenance')[];
  
  // Time Filters
  start_date?: string; // ISO 8601 datetime
  end_date?: string; // ISO 8601 datetime
  recorded_after?: string; // ISO 8601 datetime
  recorded_before?: string; // ISO 8601 datetime
  hours?: number; // Last N hours
  days?: number; // Last N days
  recorded_date?: string; // YYYY-MM-DD
  today?: boolean;
  yesterday?: boolean;
  this_week?: boolean;
  this_month?: boolean;
  timezone?: string; // Default: Africa/Addis_Ababa

  // Value Range Filters
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
  
  // Data Quality Filters
  has_pm2_5?: boolean;
  has_pm10?: boolean;
  has_temperature?: boolean;
  has_humidity?: boolean;
  has_voc_index?: boolean;
  has_nox_index?: boolean;
  has_all_readings?: boolean;
  min_readings_count?: number; // 0-6
  
  // Pagination & Sorting
  offset?: number;
  page?: number;
  page_size?: number;
  paginate?: 'cursor';
  cursor?: string;
  order_by?: string; // recorded_at, pm2_5, temperature, etc.
  order?: 'asc' | 'desc';
  
  // Response Enhancements
  include_stats?: boolean;
  include_device_info?: boolean;
  include_location_info?: boolean;
  
  // Aggregation
  group_by?: 'device' | 'location' | 'hour' | 'day' | 'week' | 'month';
  aggregate?: 'avg' | 'min' | 'max' | 'count' | 'sum';
  interval?: string; // 1h, 6h, 1d, 1w, 1m
}

export interface SensorDevicesParams extends PaginationParams {
  location_id?: string;
}

// Sensor Health / Diagnostics (Admin only) — GET /admin/sensor-health
export type SensorHealthStatus = 'online' | 'stale' | 'offline' | 'no_data';

export interface SensorHealthMetric {
  filled: number;
  fill_pct: number;
}

export interface SensorHealthSummary {
  stations: number;
  online: number;
  stale: number;
  offline: number;
  no_data: number;
  total_readings: number;
  total_bad_timestamps: number;
}

export interface SensorHealthStation {
  station: string;
  device_id: string;
  serial_number: string;
  location_id: string | null;
  device_status: string;
  status: SensorHealthStatus;
  total_readings: number;
  first_reading: string | null;
  last_reading: string | null;
  hours_since_last: number | null;
  readings_24h: number;
  expected_24h: number;
  coverage_24h_pct: number;
  bad_timestamp_count: number;
  pm25_eq_pm10_count: number;
  pm25_eq_pm10_pct: number;
  metrics: {
    pm1_0: SensorHealthMetric;
    pm2_5: SensorHealthMetric;
    pm4_0: SensorHealthMetric;
    pm10: SensorHealthMetric;
    humidity: SensorHealthMetric;
    temperature: SensorHealthMetric;
    voc_index: SensorHealthMetric;
    nox_index: SensorHealthMetric;
  };
}

export interface SensorHealthResponse {
  generated_at: string;
  timezone: string;
  summary: SensorHealthSummary;
  stations: SensorHealthStation[];
}

// Error response
export interface ApiError {
  detail?: string;
  message?: string;
  error?: string;
}

