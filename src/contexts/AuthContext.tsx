"use client";

import { useAuthStore } from "@/store/authStore";

// This hook uses Zustand store - compatibility layer for components.
//
// It reports the store's own `isAuthenticated` rather than deriving `!!user`.
// Deriving it here was the split-brain: a rehydrated `user` made this hook say
// "signed in" while the store's flag still said "signed out", so the landing
// page rendered a logged-in header whose buttons then bounced to /login.
// There is one auth truth now, and it lives in the store.
export function useAuth() {
  const { user, isLoading, isAuthenticated, login, signup, logout, refreshUser } =
    useAuthStore();

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
    signup,
    logout,
    isAuthenticated,
    isLoading,
    refreshUser,
  };
}
