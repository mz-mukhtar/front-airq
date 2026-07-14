import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  login as apiLogin,
  register as apiRegister,
  getCurrentUser,
  logout as apiLogout,
} from '@/lib/api/auth';
import { removeStoredUser } from '@/lib/api/config';
import { User } from '@/lib/api/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (name: string, email: string, password: string, passwordConfirm: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  initialize: () => Promise<void>;
}

let initializeInFlight: Promise<void> | null = null;
let hasValidatedSession = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      // Session is ambient via the httpOnly cookie: ask the backend who we are.
      initialize: async () => {
        const currentState = get();

        // Already validated this session — skip redundant /auth/me
        if (
          hasValidatedSession &&
          currentState.user &&
          currentState.isAuthenticated &&
          !currentState.isLoading
        ) {
          return;
        }

        if (initializeInFlight) {
          return initializeInFlight;
        }

        initializeInFlight = (async () => {
          if (!get().isLoading) {
            set({ isLoading: true });
          }

          // Safety net: never let the app hang on "loading" if a request stalls.
          const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
            new Promise((resolve, reject) => {
              const t = setTimeout(() => reject(new Error("auth-init-timeout")), ms);
              p.then(
                (v) => { clearTimeout(t); resolve(v); },
                (e) => { clearTimeout(t); reject(e); }
              );
            });

          try {
            // requireAuth: false — a 401 here just means "not signed in";
            // it must not redirect anonymous visitors on public pages.
            const currentUser = await withTimeout(getCurrentUser({ requireAuth: false }), 12000);
            hasValidatedSession = true;
            set({ user: currentUser, isAuthenticated: true, isLoading: false });
          } catch {
            // 401, timeout, or network failure — treat as unauthenticated
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        })().finally(() => {
          initializeInFlight = null;
        });

        return initializeInFlight;
      },

      login: async (email: string, password: string) => {
        try {
          // The proxy captures the session token into an httpOnly cookie;
          // the response body intentionally has no access_token.
          await apiLogin(email, password);
          const currentUser = await getCurrentUser();
          hasValidatedSession = true;
          set({ user: currentUser, isAuthenticated: true });
          return true;
        } catch (error) {
          console.error('Login error:', error);
          return false;
        }
      },

      loginWithGoogle: async () => {
        if (typeof window === 'undefined') return false;
        window.location.href = '/api/auth/google/login';
        return true;
      },

      signup: async (name: string, email: string, password: string, passwordConfirm: string) => {
        try {
          await apiRegister({ name, email, password, password_confirm: passwordConfirm });
          await apiLogin(email, password);
          const currentUser = await getCurrentUser();
          hasValidatedSession = true;
          set({ user: currentUser, isAuthenticated: true });
          return true;
        } catch (error) {
          console.error('Signup error:', error);
          // Re-throw the error so the component can handle it
          throw error;
        }
      },

      logout: () => {
        // Revoke the session server-side and clear the cookie via the proxy
        apiLogout().catch(() => {
          // Best-effort: cookie is cleared by the proxy even on upstream failure
        });
        // Clear the legacy "user_data" key for sessions created before it was removed
        removeStoredUser();
        hasValidatedSession = false;
        set({ user: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      refreshUser: async () => {
        try {
          const currentUser = await getCurrentUser();
          set({ user: currentUser, isAuthenticated: true });
        } catch (error) {
          console.error('Error refreshing user:', error);
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
      // Do NOT mutate isLoading / isAuthenticated here. Rehydration can run
      // after initialize() has already settled them, and forcing isLoading=true
      // would leave the app stuck on the loading screen on refresh. The persisted
      // `user` is only a hint; initialize() (-> /auth/me) is the source of truth.
    }
  )
);
