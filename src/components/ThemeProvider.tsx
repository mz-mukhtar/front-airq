"use client";

import { useEffect } from "react";
import { applyPreferencesToDocument, usePreferences } from "@/lib/preferences";

/**
 * Applies the stored theme and language to <html> and keeps them applied.
 *
 * The inline script in the root layout handles the *first* paint (so there's no
 * light flash before hydration); this component owns every change after it —
 * toggling the theme, a preference synced down from the account at login, or
 * another tab writing to localStorage.
 *
 * Renders nothing of its own. It exists purely for the document-level effect,
 * which is why it can wrap the tree without adding a DOM node.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preferences = usePreferences();
  const theme = preferences.theme;
  const language = preferences.language;

  useEffect(() => {
    applyPreferencesToDocument();
  }, [theme, language]);

  // Only an explicit "system" preference should follow the OS. Without this,
  // choosing "system" would apply once and then never track the OS switching
  // to dark at sunset.
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreferencesToDocument();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  return <>{children}</>;
}
