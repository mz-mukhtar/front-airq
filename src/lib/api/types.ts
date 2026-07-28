// API Types matching the backend models

import type { AqiStandardId } from '@/lib/utils/aqi-standards';

export type ThemePreference = 'light' | 'dark' | 'system';
export type LanguagePreference = 'en' | 'am';

export interface UserPreferences {
  theme?: ThemePreference;
  language?: LanguagePreference;
  map?: {
    defaultZoom?: number;
    defaultLocation?: { lat: number | null; lng: number | null } | null;
    showStationLabels?: boolean;
    /** Which air-quality index the map, cards and legend report against. */
    aqiStandard?: AqiStandardId;
  };
  sensors?: {
    lastSelection?: string[];
    savedComparisons?: Array<{ id: string; name: string; deviceIds: string[] }>;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  preferences?: UserPreferences | null;
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
  pm1_0?: number | null;
  pm2_5: number | null;
  pm10: number | null;
  humidity: number | null;
  temperature: number | null;
  air_quality_level: string | null;
  recorded_at: string;
}

/**
 * Public map KPI: the slim KPI plus embedded location details, from the single
 * public endpoint GET /sensor-readings/kpi-map (no separate locations request).
 */
export interface MapKPIReading extends PublicReadingKPI {
  location_name?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_description?: string | null;
}

/** Public landing-page aggregate counts from GET /public/stats. */
export interface PublicStats {
  stations: number;
  sensors: number;
  total_sensors: number;
  total_readings: number;
  /**
   * How many quantities each reading can carry — what the network collects,
   * which is more than any one page displays. Derived from the backend schema.
   * Optional so an older API that predates the field degrades to the fallback
   * rather than rendering a bare 0.
   */
  parameters_tracked?: number;
  /** Names of those quantities, in schema order. */
  parameters?: string[];
}

export type DeviceApprovalStatus = 'pending' | 'approved' | 'rejected';
export type DeviceApprovalDecision = 'approved' | 'rejected';

export interface DeviceApprovalRequest {
  approval_status: DeviceApprovalDecision;
}

export interface BulkDeviceUpdateItem {
  device_id: string;
  serial_number?: string;
  location_id?: string;
  owner_id?: string;
  approval_status?: DeviceApprovalStatus;
  approved_by?: string;
  who_deployed_it?: 'source' | 'custom';
  status?: 'active' | 'offline' | 'maintenance';
  metadata_json?: Record<string, unknown>;
}

export interface SensorDevice {
  id: string;
  location_id: string;
  who_deployed_it: 'source' | 'custom';
  serial_number: string;
  status: 'active' | 'offline' | 'maintenance';
  /** Admin-only: omitted in the public (anonymous/non-admin) projection. */
  approval_status?: DeviceApprovalStatus;
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

// ── Invite-only signup ───────────────────────────────────────────────────────

/** How new accounts can be created right now; controlled by an admin. */
export type SignupMode = 'open' | 'waitlist';

export interface SignupConfig {
  signup_mode: SignupMode;
}

/** Admin-facing settings: the mode plus the default link lifetime. */
export interface SignupSettings {
  signup_mode: SignupMode;
  invite_expire_days: number;
}

export interface SignupSettingsUpdate {
  signup_mode?: SignupMode;
  invite_expire_days?: number;
}

export interface WaitlistPendingCount {
  pending: number;
}

export interface WaitlistJoinRequest {
  name: string;
  email: string;
  organization?: string;
  reason?: string;
}

export interface WaitlistJoinResponse {
  message: string;
}

export type WaitlistStatus = 'pending' | 'approved' | 'rejected';

/** State of the most recent registration link issued for an entry. */
export type InvitationStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  organization?: string | null;
  reason?: string | null;
  status: WaitlistStatus;
  reviewed_at?: string | null;
  /** Non-null once the invitee has actually created their account. */
  registered_user_id?: string | null;
  invitation_expires_at?: string | null;
  invitation_status?: InvitationStatus | null;
  created_at: string;
  updated_at: string;
}

/** Returned once, at approval — the token is not recoverable afterwards. */
export interface InvitationLink {
  entry: WaitlistEntry;
  registration_url: string;
  token: string;
  expires_at: string;
}

/** What the registration page learns from a link before showing its form. */
export interface InvitationCheck {
  email: string;
  name?: string | null;
  expires_at: string;
}

export interface InvitationRegisterRequest {
  token: string;
  name: string;
  password: string;
  password_confirm: string;
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

export interface BulkSensorReadingRequest extends CreateSensorReadingRequest { }

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  preferences?: UserPreferences;
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
  /** Readings recorded inside the requested window (same count as total_readings). */
  readings_window: number;
  /**
   * Readings expected inside the window at the once-per-minute cadence,
   * clamped to when the device started reporting.
   */
  expected_window: number;
  coverage_pct: number;
  /** Instant the coverage expectation is measured from (ISO, local naive). */
  coverage_since: string;
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
  /** Length of the window (hours) used for reading counts / fill rates. */
  window_hours: number;
  /** Same window in days (fractional for sub-day windows, e.g. 6h → 0.25). */
  window_days: number;
  /** Resolved window bounds (naive GMT+3), whether rolling or explicitly set. */
  window_start?: string;
  window_end?: string;
  summary: SensorHealthSummary;
  stations: SensorHealthStation[];
}

// Admin Operations and Infrastructure Monitoring Types
export interface DatabaseConnectionPoolStats {
  /** Base pool size — connections kept open between requests. */
  pool_size: number;
  /** Extra connections the pool may open beyond pool_size under load. */
  max_overflow?: number;
  /** pool_size + max_overflow — what utilization is measured against. */
  capacity?: number;
  checked_in: number;
  checked_out: number;
  /** Overflow connections currently open (0 when the base pool suffices). */
  overflow: number;
  /** Connections invalidated since start-up — a rising count means an unstable link. */
  invalid: number;
  soft_invalid?: number;
  available: number;
  utilization_percent: number;
}

export interface DatabaseInfo {
  version?: string;
  timezone?: string;
  size?: string;
  active_connections?: number;
}

export interface DatabaseHealthResponse {
  status: string;
  timestamp: string | null;
  connection_pool: DatabaseConnectionPoolStats | Record<string, never>;
  database_info: DatabaseInfo;
  errors: string[];
}

export interface DatabasePoolStatsResponse {
  connection_pool: DatabaseConnectionPoolStats;
  timestamp: string | null;
}

export interface PerformanceEndpointMetric {
  total_requests: number;
  avg_response_time_ms?: number;
  min_response_time_ms?: number;
  max_response_time_ms?: number;
  p95_response_time_ms?: number;
  p99_response_time_ms?: number;
}

export interface PerformanceSingleEndpointMetric extends PerformanceEndpointMetric {
  endpoint: string;
}

export interface PerformanceStatsResponse {
  performance_stats: Record<string, PerformanceEndpointMetric> | PerformanceSingleEndpointMetric;
  timestamp: string | null;
}

export interface LogCleanupResults {
  audit_logs: number;
  password_reset_tokens: number;
  password_history: number;
  token_blacklist: number;
  /** Request logs past the 7-day retention window. */
  request_logs?: number;
  timestamp: string;
}

export interface LogCleanupResponse {
  message: string;
  results: LogCleanupResults;
}

export interface RequestLog {
  id: string;
  request_id: string;
  method: string;
  path: string;
  /** Raw query string, without the leading "?" (null when there was none). */
  query_string?: string | null;
  status_code: number;
  duration_ms: number | null;
  device_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  error_detail: string | null;
  created_at: string;
}

/** The single-row shape: adds the fields too heavy for the list. */
export interface RequestLogFull extends RequestLog {
  /** As sent, credentials redacted. Kept for failed requests only. */
  request_body?: string | null;
  /** The exception behind a 5xx — never shown to the original caller. */
  internal_error?: string | null;
}

export interface RequestLogLocationBrief {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
}

export interface RequestLogDeviceBrief {
  id: string;
  serial_number: string;
  status?: string | null;
  approval_status?: string | null;
  installed_at?: string | null;
  location?: RequestLogLocationBrief | null;
}

export interface RequestLogUserBrief {
  id: string;
  name?: string | null;
  email: string;
  role?: string | null;
}

export interface RequestLogDetail {
  log: RequestLogFull;
  device: RequestLogDeviceBrief | null;
  user: RequestLogUserBrief | null;
  /** Other requests sharing this correlation id. */
  related: RequestLog[];
  /** The same device's or user's recent requests — one-off or pattern? */
  actor_history: RequestLog[];
}

export interface RequestLogsParams {
  request_id?: string;
  method?: string;
  path?: string;
  status_code?: number;
  errors_only?: boolean;
  device_id?: string;
  user_email?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

// Error response
export interface ApiError {
  detail?: string;
  message?: string;
  error?: string;
}

export * from './analytics';
