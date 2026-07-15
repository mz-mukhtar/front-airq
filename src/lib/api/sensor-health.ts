import { apiRequest } from './client';
import { SensorHealthResponse } from './types';

// Get sensor health / diagnostics report (Admin only).
export async function getSensorHealth(days?: number): Promise<SensorHealthResponse> {
  const query = days !== undefined ? `?days=${encodeURIComponent(days)}` : '';
  return apiRequest<SensorHealthResponse>(`/admin/sensor-health${query}`, {
    requireAuth: true,
  });
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
