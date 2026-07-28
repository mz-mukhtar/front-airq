import { apiRequest } from './client';
import { SensorHealthResponse } from './types';

/**
 * The diagnostics window: either rolling (`hours`, 1-8760, backend default 6)
 * or an explicit `start_date`/`end_date` pair, which is the only way to report
 * on a period that has already ended.
 */
export type SensorHealthWindow =
  | { hours: number }
  | { start_date: string; end_date: string };

// Get sensor health / diagnostics report (Admin only).
// The window drives every per-reading figure — counts, coverage, fill rates and
// duplication stats. Freshness and first/last reading stay lifetime: whether a
// station is up right now is not a question about the selected window.
export async function getSensorHealth(
  window?: SensorHealthWindow
): Promise<SensorHealthResponse> {
  const params = new URLSearchParams();
  if (window) {
    if ('hours' in window) {
      params.set('hours', String(window.hours));
    } else {
      params.set('start_date', window.start_date);
      params.set('end_date', window.end_date);
    }
  }
  const query = params.toString();
  return apiRequest<SensorHealthResponse>(
    `/admin/sensor-health${query ? `?${query}` : ''}`,
    { requireAuth: true }
  );
}

// Purge readings with invalid timestamps (Admin only).
// Omit deviceId to purge across all devices.
export async function purgeBadTimestamps(
  deviceId?: string
): Promise<{ deleted: number }> {
  return apiRequest<{ deleted: number }>(
    '/admin/sensor-health/purge-bad-timestamps' +
    (deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''),
    { method: 'POST', requireAuth: true }
  );
}
