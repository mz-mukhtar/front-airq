"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWaitlistNotificationStore } from "@/store/waitlistNotificationStore";

/** How often to re-check while the tab is in the foreground. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Keeps the admin's pending-request count fresh for the navigation badge.
 *
 * Polls only for admins, and only while the tab is visible — a background tab
 * counting rows every minute is pure server load for a number nobody is
 * looking at. Coming back to the tab triggers an immediate refresh, which is
 * the moment the number is most likely to be stale.
 */
export function useWaitlistNotifications() {
  const { user, isAuthenticated } = useAuth();
  const pending = useWaitlistNotificationStore((s) => s.pending);
  const loaded = useWaitlistNotificationStore((s) => s.loaded);
  const refresh = useWaitlistNotificationStore((s) => s.refresh);
  const reset = useWaitlistNotificationStore((s) => s.reset);

  const isAdmin = isAuthenticated && user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      // Signing out (or being demoted) must drop the count — a stale badge
      // would leak the size of the queue to whoever signs in next.
      reset();
      return;
    }

    let cancelled = false;
    const tick = () => {
      if (!cancelled && document.visibilityState === "visible") {
        refresh();
      }
    };

    tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isAdmin, refresh, reset]);

  return { pending: isAdmin ? pending : 0, loaded: isAdmin && loaded };
}
