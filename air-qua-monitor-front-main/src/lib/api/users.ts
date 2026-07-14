import { apiRequest, apiFormRequest } from './client';
import {
  User,
  UserAdminCreate,
  UserAdminUpdate,
  ResetPasswordRequest,
} from './types';

// Get all users (Admin only)
export async function getUsers(): Promise<User[]> {
  return apiRequest<User[]>('/users/');
}

// Get user by ID (Admin only)
export async function getUserById(userId: string): Promise<User> {
  return apiRequest<User>(`/users/${userId}`);
}

// Create user (Admin only)
export async function createUser(data: UserAdminCreate): Promise<User> {
  return apiRequest<User>('/users/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update user (Admin only)
export async function updateUser(
  userId: string,
  data: UserAdminUpdate
): Promise<User> {
  return apiRequest<User>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Reset user password (Admin only)
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/users/${userId}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ new_password: newPassword }),
  });
}

// Delete user (Admin only)
export async function deleteUser(userId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/users/${userId}`, {
    method: 'DELETE',
  });
}

