import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  login as apiLogin,
  register as apiRegister,
  getCurrentUser,
  logout as apiLogout,
} from '@/lib/api/auth';
import { removeStoredUser } from '@/lib/api/config';
import { clearAccountPreferences } from '@/lib/preferences';
import { User } from '@/lib/api/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, passwordConfirm: string) => Promise<boolean>;
  logout: () => Promise<void>;
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

      logout: async () => {
        // AWAIT the revocation before navigating.
        //
        // This used to fire apiLogout() without awaiting and immediately assign
        // window.location.href. That assignment aborts in-flight fetches, so the
        // two raced — and when the request lost, nothing on the server side
        // happened at all: the backend never blacklisted the JWT, and the
        // proxy's cookie-clearing Set-Cookie never reached the browser. The user
        // landed on /login still holding a valid aq_session, so the very next
        // /auth/me signed them straight back in. It looked like logout simply
        // did not work, and the token stayed usable until it expired.
        try {
          await apiLogout();
        } catch {
          // Network failure or upstream error. The proxy clears the cookie on
          // every logout response including its own 502, so a reachable
          // frontend is enough to end the browser session; a token that was
          // never blacklisted will expire on its own.
        }

        // Clear the legacy "user_data" key for sessions created before it was removed
        removeStoredUser();
        // Account-scoped preferences must not follow the next person who signs
        // in on this browser — see clearAccountPreferences.
        clearAccountPreferences();
        hasValidatedSession = false;
        set({ user: null, isAuthenticated: false });

        if (typeof window !== 'undefined') {
          // Full reload rather than a client navigation: it guarantees every
          // module-level cache and in-memory store is dropped with the session.
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
      // Persist `user` and `isAuthenticated` together. Persisting only `user`
      // split the two apart on rehydration: `isAuthenticated` came back false
      // while `user` came back set, so anything deriving auth from `user` (the
      // useAuth compat layer) disagreed with anything reading the flag directly
      // (/stations, /dashboard) until initialize() resolved. Every mutation in
      // this store already sets both fields, so keeping them together here is
      // what makes them impossible to diverge.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Do NOT mutate isLoading here. Rehydration can run after initialize()
      // has already settled it, and forcing isLoading=true would leave the app
      // stuck on the loading screen on refresh. The persisted pair is only an
      // optimistic hint; initialize() (-> /auth/me) is the source of truth, so
      // callers that act on it must gate on isLoading first.
    }
  )
);
