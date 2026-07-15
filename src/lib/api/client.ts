import { buildProxyUrl, removeStoredUser } from './config';

// Validation error structure from backend
export interface ValidationError {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: any;
  ctx?: Record<string, any>;
}

// Full error response structure
export interface ErrorResponse {
  error?: boolean;
  status_code?: number;
  detail?: string | Record<string, unknown>;
  message?: string;
  errors?: ValidationError[];
}

function formatErrorDetail(detail: ErrorResponse['detail'], fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }
  return fallback;
}

// Custom error class for API errors
export class ApiException extends Error {
  constructor(
    public status: number,
    public detail: string,
    public originalError?: any,
    public errors?: ValidationError[]
  ) {
    super(detail);
    this.name = 'ApiException';
    // Ensure the error message is properly set
    this.message = detail;
  }

  // Override toString for better console logging
  toString(): string {
    return `ApiException [${this.status}]: ${this.detail}`;
  }

  // Get a user-friendly error message
  getMessage(): string {
    return this.detail;
  }

  // Get validation errors formatted for display
  getValidationErrors(): string[] {
    if (!this.errors || this.errors.length === 0) {
      return [this.detail];
    }
    return this.errors.map(err => {
      // Format location (e.g., ["body", "password"] -> "password")
      const field = err.loc.length > 1 ? err.loc[err.loc.length - 1] : err.loc[0];
      return `${String(field)}: ${err.msg}`;
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : 0;
  }
  return null;
}

function extractRetryAfterMs(response: Response, errorData?: ErrorResponse): number {
  const fromHeader = parseRetryAfterMs(response.headers.get('Retry-After'));
  if (fromHeader !== null) return fromHeader;

  const detail = errorData?.detail;
  if (typeof detail === 'string') {
    const match = detail.match(/Retry in (\d+)s/i);
    if (match) return parseInt(match[1], 10) * 1000;
  }
  return 1000;
}

/** Endpoints that must never trigger the silent-refresh-and-retry flow on 401. */
function isAuthBypassEndpoint(endpoint: string): boolean {
  const path = endpoint.split('?')[0].replace(/\/+$/, '');
  return path.endsWith('/auth/login') || path.endsWith('/auth/refresh')
    || path === 'auth/login' || path === 'auth/refresh'
    || path === '/auth/login' || path === '/auth/refresh';
}

// Single-flight guard: concurrent 401s share one /auth/refresh request instead
// of firing N parallel refreshes (which can invalidate rotating refresh tokens).
let refreshInFlight: Promise<boolean> | null = null;

/** Attempt a one-shot session refresh via the proxy. Returns true on success. */
function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(buildProxyUrl('/auth/refresh'), {
        method: 'POST',
      });
      return response.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Clear local user state and send the browser to /login. */
function handleSessionExpired(): void {
  removeStoredUser();
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

// Base fetch wrapper with error handling. Authentication is ambient: the
// session rides along in an httpOnly cookie handled by the Next.js proxy.
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { requireAuth?: boolean; _retryCount?: number; _refreshAttempted?: boolean } = {}
): Promise<T> {
  const { requireAuth = true, _retryCount = 0, _refreshAttempted = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const url = buildProxyUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle errors - read response body first to get error details
    if (!response.ok) {
      // Silent refresh-and-retry on 401 (except for login/refresh themselves)
      if (
        response.status === 401 &&
        !_refreshAttempted &&
        !isAuthBypassEndpoint(endpoint)
      ) {
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          return apiRequest<T>(endpoint, { ...options, _refreshAttempted: true });
        }
        if (requireAuth) {
          handleSessionExpired();
          throw new ApiException(401, 'Unauthorized. Please login again.');
        }
      }

      // Read response as text first (can only read once)
      const responseText = await response.text();
      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      let validationErrors: ValidationError[] | undefined;

      if (responseText && responseText.trim()) {
        try {
          const errorData: ErrorResponse = JSON.parse(responseText);
          errorDetail = formatErrorDetail(
            errorData.detail,
            errorData.message || (typeof errorData.error === 'string' ? errorData.error : '') || errorDetail
          );
          if (errorData.errors && Array.isArray(errorData.errors)) {
            validationErrors = errorData.errors;
          }

          if (response.status === 401) {
            if (requireAuth) {
              handleSessionExpired();
              throw new ApiException(401, 'Unauthorized. Please login again.');
            }
            throw new ApiException(401, errorDetail, errorData, validationErrors);
          }

          if (response.status === 429 && _retryCount < 3) {
            const retryMs = extractRetryAfterMs(response, errorData);
            await sleep(retryMs);
            return apiRequest<T>(endpoint, {
              ...options,
              _retryCount: _retryCount + 1,
            });
          }

          throw new ApiException(response.status, errorDetail, errorData, validationErrors);
        } catch (parseOrThrow) {
          if (parseOrThrow instanceof ApiException) {
            throw parseOrThrow;
          }
          errorDetail = responseText;
        }
      }

      if (response.status === 401) {
        if (requireAuth) {
          handleSessionExpired();
          throw new ApiException(401, 'Unauthorized. Please login again.');
        }
        throw new ApiException(401, errorDetail, undefined, validationErrors);
      }

      if (response.status === 429 && _retryCount < 3) {
        const retryMs = extractRetryAfterMs(response);
        await sleep(retryMs);
        return apiRequest<T>(endpoint, {
          ...options,
          _retryCount: _retryCount + 1,
        });
      }

      throw new ApiException(response.status, errorDetail, undefined, validationErrors);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    // Try to parse JSON response
    let data: T;
    try {
      data = await response.json();
    } catch (parseError) {
      if (response.ok && response.status >= 200 && response.status < 300) {
        throw new ApiException(
          0,
          'Invalid response from server. Please try again.',
          parseError
        );
      }
      throw parseError;
    }
    return data;
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiException(
        0,
        'Network error: unable to reach the server. Please check your connection and try again.',
        error
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new ApiException(
          0,
          'Network error: unable to reach the server. Please check your connection and try again.',
          error
        );
      }
      throw new ApiException(0, error.message, error);
    }

    throw new ApiException(0, 'Unknown network error occurred', error);
  }
}

// Form data request (for login and password update)
async function apiFormRequest<T>(
  endpoint: string,
  formData: URLSearchParams,
  options: RequestInit & { _refreshAttempted?: boolean } = {}
): Promise<T> {
  const { _refreshAttempted = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const url = buildProxyUrl(endpoint);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${fetchOptions.method || 'POST'} ${url}`);
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      method: fetchOptions.method || 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      if (!_refreshAttempted && !isAuthBypassEndpoint(endpoint)) {
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          return apiFormRequest<T>(endpoint, formData, { ...options, _refreshAttempted: true });
        }
        handleSessionExpired();
        throw new ApiException(401, 'Unauthorized. Please login again.');
      }
      if (isAuthBypassEndpoint(endpoint)) {
        // Login/refresh failures: surface the backend error message
        const responseText = await response.text();
        let errorDetail = 'Invalid credentials';
        try {
          const errorData: ErrorResponse = JSON.parse(responseText);
          errorDetail = formatErrorDetail(errorData.detail, errorDetail);
        } catch {
          // keep default detail
        }
        throw new ApiException(401, errorDetail);
      }
      handleSessionExpired();
      throw new ApiException(401, 'Unauthorized. Please login again.');
    }

    if (!response.ok) {
      // Read response as text first (can only read once)
      const responseText = await response.text();
      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      let validationErrors: ValidationError[] | undefined;

      if (responseText && responseText.trim()) {
        try {
          const errorData: ErrorResponse = JSON.parse(responseText);
          errorDetail = formatErrorDetail(
            errorData.detail,
            errorData.message || (typeof errorData.error === 'string' ? errorData.error : '') || errorDetail
          );
          if (errorData.errors && Array.isArray(errorData.errors)) {
            validationErrors = errorData.errors;
          }
          throw new ApiException(response.status, errorDetail, errorData, validationErrors);
        } catch (parseOrThrow) {
          if (parseOrThrow instanceof ApiException) {
            throw parseOrThrow;
          }
          errorDetail = responseText;
        }
      }
      throw new ApiException(response.status, errorDetail, undefined, validationErrors);
    }

    if (response.status === 204) {
      return {} as T;
    }

    // Try to parse JSON response
    let data: T;
    try {
      data = await response.json();
    } catch (parseError) {
      if (response.ok && response.status >= 200 && response.status < 300) {
        throw new ApiException(
          0,
          'Invalid response from server. Please try again.',
          parseError
        );
      }
      throw parseError;
    }
    return data;
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiException(
        0,
        'Network error: unable to reach the server. Please check your connection and try again.',
        error
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new ApiException(
          0,
          'Network error: unable to reach the server. Please check your connection and try again.',
          error
        );
      }
      throw new ApiException(0, error.message, error);
    }

    throw new ApiException(0, 'Unknown network error occurred', error);
  }
}

// Downloaded file structure from blob request
export interface DownloadedFile {
  blob: Blob;
  filename?: string;
  contentType?: string;
}

function extractFilenameFromContentDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  let rawFilename: string | undefined;

  const filenameStarMatch = header.match(/filename\*\s*=\s*(?:utf-8|UTF-8)''([^;\r\n]+)/i);
  if (filenameStarMatch && filenameStarMatch[1]) {
    try {
      rawFilename = decodeURIComponent(filenameStarMatch[1]);
    } catch {
      // fallback to regular match
    }
  }

  if (!rawFilename) {
    const filenameMatch = header.match(/filename\s*=\s*(?:"([^"]+)"|([^;\r\n]+))/i);
    if (filenameMatch) {
      rawFilename = (filenameMatch[1] || filenameMatch[2]);
    }
  }

  if (!rawFilename) return undefined;

  // Remove null and control characters
  let sanitized = rawFilename.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip directory paths (handle both / and \)
  const parts = sanitized.split(/[/\\]/);
  sanitized = parts[parts.length - 1] || '';

  // Trim whitespace
  sanitized = sanitized.trim();

  // Reject empty filenames, "." and ".."
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return undefined;
  }

  return sanitized;
}

async function apiBlobRequest(
  endpoint: string,
  options: RequestInit & { requireAuth?: boolean; _retryCount?: number; _refreshAttempted?: boolean } = {}
): Promise<DownloadedFile> {
  const { requireAuth = true, _retryCount = 0, _refreshAttempted = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const url = buildProxyUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      if (
        response.status === 401 &&
        !_refreshAttempted &&
        !isAuthBypassEndpoint(endpoint)
      ) {
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          return apiBlobRequest(endpoint, { ...options, _refreshAttempted: true });
        }
        if (requireAuth) {
          handleSessionExpired();
          throw new ApiException(401, 'Unauthorized. Please login again.');
        }
      }

      const responseText = await response.text();
      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      let validationErrors: ValidationError[] | undefined;

      if (responseText && responseText.trim()) {
        try {
          const errorData: ErrorResponse = JSON.parse(responseText);
          errorDetail = formatErrorDetail(
            errorData.detail,
            errorData.message || (typeof errorData.error === 'string' ? errorData.error : '') || errorDetail
          );
          if (errorData.errors && Array.isArray(errorData.errors)) {
            validationErrors = errorData.errors;
          }
          if (response.status === 401) {
            if (requireAuth) {
              handleSessionExpired();
              throw new ApiException(401, 'Unauthorized. Please login again.');
            }
            throw new ApiException(401, errorDetail, errorData, validationErrors);
          }
          throw new ApiException(response.status, errorDetail, errorData, validationErrors);
        } catch (parseOrThrow) {
          if (parseOrThrow instanceof ApiException) {
            throw parseOrThrow;
          }
          errorDetail = responseText;
        }
      }

      if (response.status === 401 && requireAuth) {
        handleSessionExpired();
        throw new ApiException(401, 'Unauthorized. Please login again.');
      }

      throw new ApiException(response.status, errorDetail, undefined, validationErrors);
    }

    const blob = await response.blob();
    const filename = extractFilenameFromContentDisposition(
      response.headers.get('content-disposition') || response.headers.get('Content-Disposition')
    );
    const contentType =
      response.headers.get("Content-Type") ??
      blob.type ??
      undefined;
    return { blob, filename, contentType };
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiException(
        0,
        'Network error: unable to reach the server. Please check your connection and try again.',
        error
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new ApiException(
          0,
          'Network error: unable to reach the server. Please check your connection and try again.',
          error
        );
      }
      throw new ApiException(0, error.message, error);
    }

    throw new ApiException(0, 'Unknown network error occurred', error);
  }
}

export { apiRequest, apiFormRequest, apiBlobRequest };
