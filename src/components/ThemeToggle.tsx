"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveTheme, updatePreferences, usePreferences } from "@/lib/preferences";

// Hydration-safe "is client" flag: false during SSR/hydration, true after.
const emptySubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Light/dark toggle button. Sets an explicit theme preference (overriding
 * "system") and persists it like any other preference — localStorage instantly,
 * account via the debounced sync. ThemeProvider (mounted in the root layout)
 * applies the change to <html> live.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const preferences = usePreferences();
  // The resolved theme depends on localStorage/matchMedia, which the server
  // can't know — show the light-mode icon until the client takes over.
  const isClient = useIsClient();

  const resolved = isClient ? resolveTheme(preferences.theme) : "light";
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => updatePreferences({ theme: next })}
      className={className}
      suppressHydrationWarning
    >
      {resolved === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
