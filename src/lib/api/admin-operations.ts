import { apiRequest } from './client';
import {
  DatabaseHealthResponse,
  DatabasePoolStatsResponse,
  PerformanceStatsResponse,
  LogCleanupResponse,
  RequestLog,
  RequestLogsParams,
} from './types';

// Get database health check and basic pool/connection information (Admin only).
export async function getDatabaseHealth(): Promise<DatabaseHealthResponse> {
  return apiRequest<DatabaseHealthResponse>('/admin/database/health', {
    requireAuth: true,
  });
}

// Get detailed connection pool statistics (Admin only).
export async function getDatabasePoolStats(): Promise<DatabasePoolStatsResponse> {
  return apiRequest<DatabasePoolStatsResponse>('/admin/database/pool-stats', {
    requireAuth: true,
  });
}

// Get API performance statistics collected by middleware (Admin only).
export async function getPerformanceStats(endpoint?: string): Promise<PerformanceStatsResponse> {
  const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
  return apiRequest<PerformanceStatsResponse>(`/admin/performance/stats${query}`, {
    requireAuth: true,
  });
}

// Trigger log retention cleanup (Admin only).
export async function cleanupAdminLogs(): Promise<LogCleanupResponse> {
  return apiRequest<LogCleanupResponse>('/admin/logs/cleanup', {
    method: 'POST',
    requireAuth: true,
  });
}

// Query recorded request logs with optional filtering and pagination (Admin only).
export async function getRequestLogs(params: RequestLogsParams = {}): Promise<RequestLog[]> {
  const searchParams = new URLSearchParams();

  if (params.request_id) searchParams.set('request_id', params.request_id);
  if (params.method) searchParams.set('method', params.method);
  if (params.path) searchParams.set('path', params.path);
  if (params.status_code !== undefined) searchParams.set('status_code', params.status_code.toString());
  if (params.errors_only) searchParams.set('errors_only', 'true');
  if (params.device_id) searchParams.set('device_id', params.device_id);
  if (params.user_email) searchParams.set('user_email', params.user_email);
  if (params.since) searchParams.set('since', params.since);
  if (params.until) searchParams.set('until', params.until);
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
  if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());

  const queryString = searchParams.toString();
  const endpoint = queryString ? `/request-logs?${queryString}` : '/request-logs';

  return apiRequest<RequestLog[]>(endpoint, {
    requireAuth: true,
  });
}
