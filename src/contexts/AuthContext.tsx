"use client";

import { useAuthStore } from "@/store/authStore";
import { User } from "@/lib/api/types";

// This hook uses Zustand store - compatibility layer for components
export function useAuth() {
  const { user, isLoading, login, signup, logout, refreshUser, loginWithGoogle } = useAuthStore();

  return {
    user: user
      ? {
          email: user.email,
          name: user.name,
          id: user.id,
          role: user.role,
        }
      : null,
    login,
    loginWithGoogle,
    signup,
    logout,
    isAuthenticated: !!user,
    isLoading,
    refreshUser,
  };
}
