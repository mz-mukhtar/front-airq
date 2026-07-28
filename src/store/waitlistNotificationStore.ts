import { create } from 'zustand';
import { getWaitlistPendingCount } from '@/lib/api/waitlist';

interface WaitlistNotificationState {
  /** Access requests awaiting an admin decision. 0 until the first fetch lands. */
  pending: number;
  /** False until a fetch has succeeded, so the badge can stay hidden rather than flash "0". */
  loaded: boolean;
  refresh: () => Promise<void>;
  reset: () => void;
}

// Single-flight guard. The badge renders in more than one place (sidebar, map
// chrome) and the admin page refreshes it after every decision — without this,
// one navigation could fire several identical counts.
let inFlight: Promise<void> | null = null;

export const useWaitlistNotificationStore = create<WaitlistNotificationState>()(
  (set) => ({
    pending: 0,
    loaded: false,

    refresh: async () => {
      if (inFlight) return inFlight;

      inFlight = (async () => {
        try {
          const { pending } = await getWaitlistPendingCount();
          set({ pending, loaded: true });
        } catch {
          // A failed count must not surface as an error anywhere: this is a
          // background poll for a badge, not something the admin asked for.
          // Keep the last known value rather than blanking the badge.
        }
      })().finally(() => {
        inFlight = null;
      });

      return inFlight;
    },

    reset: () => set({ pending: 0, loaded: false }),
  })
);
