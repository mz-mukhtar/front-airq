import { apiRequest } from './client';
import { dedupeAsync } from './dedupe';
import {
  SensorDevice,
  SensorDeviceCreateResponse,
  CreateSensorDeviceRequest,
  UpdateSensorDeviceRequest,
  SensorDevicesParams,
  DeviceApprovalDecision,
  BulkDeviceUpdateItem,
} from './types';

// Get all sensor devices (backend requires authentication; requireAuth:false
// only suppresses the login redirect on ambient/unauthenticated fetches)
export async function getSensorDevices(params?: SensorDevicesParams): Promise<SensorDevice[]> {
  const queryParams = new URLSearchParams();
  if (params?.location_id) queryParams.append('location_id', params.location_id);

  const query = queryParams.toString();
  const fetchDevices = () =>
    apiRequest<SensorDevice[]>(`/sensor-devices/${query ? `?${query}` : ''}`, {
      requireAuth: false,
    });

  // The no-arg "all devices" call is fetched by several components per mount;
  // coalesce those into one request.
  if (!query) {
    return dedupeAsync('sensor-devices:all', fetchDevices, 15_000);
  }
  return fetchDevices();
}

// Get sensor device by ID (backend requires authentication)
export async function getSensorDeviceById(deviceId: string): Promise<SensorDevice> {
  return apiRequest<SensorDevice>(`/sensor-devices/${deviceId}`, {
    requireAuth: false,
  });
}

// Create sensor device (Admin only). Response includes the one-time plaintext api_key.
export async function createSensorDevice(
  data: CreateSensorDeviceRequest
): Promise<SensorDeviceCreateResponse> {
  return apiRequest<SensorDeviceCreateResponse>('/sensor-devices/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update sensor device (Admin only)
export async function updateSensorDevice(
  deviceId: string,
  data: UpdateSensorDeviceRequest
): Promise<SensorDevice> {
  return apiRequest<SensorDevice>(`/sensor-devices/${deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Delete sensor device (Admin only)
export async function deleteSensorDevice(deviceId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/sensor-devices/${deviceId}`, {
    method: 'DELETE',
  });
}

/** Response from regenerate-api-key endpoint (OpenAPI: ApiKeyRegenerateResponse) */
export interface ApiKeyRegenerateResponse {
  device_id: string;
  api_key: string;
  message?: string;
}

// Regenerate device API key (Admin only). Returns new api_key; previous key is invalidated.
export async function regenerateDeviceApiKey(deviceId: string): Promise<ApiKeyRegenerateResponse> {
  return apiRequest<ApiKeyRegenerateResponse>(
    `/sensor-devices/${deviceId}/regenerate-api-key`,
    { method: 'POST' }
  );
}

// Approve or reject a sensor device (Admin only)
export async function updateDeviceApproval(
  deviceId: string,
  approvalStatus: DeviceApprovalDecision
): Promise<SensorDevice> {
  return apiRequest<SensorDevice>(`/sensor-devices/${deviceId}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ approval_status: approvalStatus }),
  });
}

// Bulk update sensor devices (Admin only)
export async function bulkUpdateSensorDevices(
  updates: BulkDeviceUpdateItem[]
): Promise<SensorDevice[]> {
  return apiRequest<SensorDevice[]>('/sensor-devices/', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

