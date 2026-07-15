import { apiRequest, apiFormRequest } from './client';
import {
  User,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  LogoutResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateUserRequest,
  UpdatePasswordRequest,
  CreateAdminRequest,
  UpdateRoleRequest,
} from './types';

// Register a new user
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Login — the session token is captured into an httpOnly cookie by the proxy;
// the response body no longer contains access_token.
export async function login(email: string, password: string): Promise<LoginResponse> {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  return apiFormRequest<LoginResponse>('/auth/login', formData, {
    method: 'POST',
  });
}

// Refresh session — proxy rotates the httpOnly cookie
export async function refreshToken(): Promise<RefreshTokenResponse> {
  return apiRequest<RefreshTokenResponse>('/auth/refresh', {
    method: 'POST',
  });
}

// Logout — proxy clears the session cookie
export async function logout(): Promise<LogoutResponse> {
  return apiRequest<LogoutResponse>('/auth/logout', {
    method: 'POST',
  });
}

// Get current user. Pass requireAuth: false for ambient session checks
// (e.g. app initialization) so a 401 does not force a redirect to /login.
export async function getCurrentUser(options?: { requireAuth?: boolean }): Promise<User> {
  return apiRequest<User>('/auth/me', {
    requireAuth: options?.requireAuth ?? true,
  });
}

// Update current user
export async function updateCurrentUser(data: UpdateUserRequest): Promise<User> {
  return apiRequest<User>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Request a password reset email. Backend always returns generic 200.
export async function requestPasswordReset(email: string): Promise<{ message?: string }> {
  return apiRequest<{ message?: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
    requireAuth: false,
  });
}

// Complete a password reset using the token from the email link.
export async function completePasswordReset(
  token: string,
  newPassword: string
): Promise<{ message?: string }> {
  return apiRequest<{ message?: string }>('/auth/password-reset/complete', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
    requireAuth: false,
  });
}

// Exchange a one-time Google OAuth code for a session (cookie set by proxy).
export async function exchangeGoogleCode(code: string): Promise<{ token_type?: string; expires_in?: number }> {
  return apiRequest<{ token_type?: string; expires_in?: number }>('/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
    requireAuth: false,
  });
}

// Update password
export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  const formData = new URLSearchParams();
  formData.append('current_password', currentPassword);
  formData.append('new_password', newPassword);
  
  return apiFormRequest<{ message: string }>('/auth/me/password', formData, {
    method: 'PUT',
  });
}

