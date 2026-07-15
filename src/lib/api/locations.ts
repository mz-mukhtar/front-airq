import { apiRequest, ApiException } from './client';
import { dedupeAsync } from './dedupe';
import {
  Location,
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationDeleteConflictDetail,
  LocationDeleteSuccessResponse,
} from './types';

// Get all locations (public endpoint - no auth required)
export async function getLocations(): Promise<Location[]> {
  return dedupeAsync('locations', () =>
    apiRequest<Location[]>('/locations/', {
      requireAuth: false,
    })
  );
}

// Get location by ID (public endpoint - no auth required)
export async function getLocationById(locationId: string): Promise<Location> {
  return apiRequest<Location>(`/locations/${locationId}`, {
    requireAuth: false,
  });
}

// Create location (Admin only)
export async function createLocation(data: CreateLocationRequest): Promise<Location> {
  return apiRequest<Location>('/locations/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update location (Admin only)
export async function updateLocation(
  locationId: string,
  data: UpdateLocationRequest
): Promise<Location> {
  return apiRequest<Location>(`/locations/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Delete location (Admin only). Pass cascade=true after user confirms 409 conflict.
export async function deleteLocation(
  locationId: string,
  options?: { cascade?: boolean }
): Promise<LocationDeleteSuccessResponse> {
  const query = options?.cascade ? '?cascade=true' : '';
  return apiRequest<LocationDeleteSuccessResponse>(`/locations/${locationId}${query}`, {
    method: 'DELETE',
  });
}

export function parseLocationDeleteConflict(
  err: unknown
): LocationDeleteConflictDetail | null {
  if (!(err instanceof ApiException) || err.status !== 409) return null;

  const payload = err.originalError as { detail?: unknown } | undefined;
  const detail = payload?.detail;
  if (!detail || typeof detail !== 'object') return null;

  const conflict = detail as Record<string, unknown>;
  if (
    typeof conflict.message !== 'string' ||
    typeof conflict.device_count !== 'number' ||
    typeof conflict.reading_count !== 'number'
  ) {
    return null;
  }

  return {
    message: conflict.message,
    device_count: conflict.device_count,
    reading_count: conflict.reading_count,
    requires_cascade: Boolean(conflict.requires_cascade),
  };
}
