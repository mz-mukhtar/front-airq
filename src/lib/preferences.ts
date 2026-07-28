"use client";

import { useSyncExternalStore } from "react";
import { updateCurrentUser } from "@/lib/api/auth";
import { ThemePreference, UserPreferences } from "@/lib/api/types";
import {
  AqiStandard,
  DEFAULT_AQI_STANDARD_ID,
  getAqiStandard,
} from "@/lib/utils/aqi-standards";

/**
 * Client preference store.
 *
 * Source of truth is localStorage ("userPreferences") for instant reads on
 * every page; changes are debounced up to PATCH /auth/me so preferences follow
 * the account across browsers. On login the server copy wins (adoptServerPreferences).
 *
 * Map-related preferences are additionally mirrored to the legacy
 * "mapSettings" key + "mapSettingsChanged" event that Map.tsx already listens to.
 */

const STORAGE_KEY = "userPreferences";
const LEGACY_MAP_KEY = "mapSettings";
export const PREFERENCES_CHANGED_EVENT = "preferencesChanged";
const SERVER_SYNC_DEBOUNCE_MS = 1500;

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  language: "en",
  map: {
    defaultZoom: 12,
    defaultLocation: null,
    showStationLabels: true,
    aqiStandard: DEFAULT_AQI_STANDARD_ID,
  },
  sensors: { lastSelection: [], savedComparisons: [] },
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Shallow-per-section merge: sections are merged, section fields overwrite. */
function mergePreferences(base: UserPreferences, patch: UserPreferences): UserPreferences {
  return {
    ...base,
    ...patch,
    map: { ...base.map, ...patch.map },
    sensors: { ...base.sensors, ...patch.sensors },
  };
}

export function loadPreferences(): UserPreferences {
  if (!isBrowser()) return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return mergePreferences(DEFAULT_PREFERENCES, JSON.parse(raw) as UserPreferences);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Keep the legacy mapSettings key in sync so Map.tsx keeps working unchanged. */
function syncLegacyMapSettings(prefs: UserPreferences) {
  if (!isBrowser()) return;
  const map = prefs.map ?? {};
  localStorage.setItem(
    LEGACY_MAP_KEY,
    JSON.stringify({
      defaultZoom: map.defaultZoom ?? 12,
      defaultLocation: map.defaultLocation ?? null,
      showStationLabels: map.showStationLabels ?? true,
    })
  );
  window.dispatchEvent(new Event("mapSettingsChanged"));
}

let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced push of the full preferences object to the account (best-effort). */
function scheduleServerSync() {
  if (!isBrowser()) return;
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(() => {
    serverSyncTimer = null;
    const prefs = loadPreferences();
    // Swallow failures (signed out / offline): localStorage still has the copy
    // and the next successful login will push it up again.
    updateCurrentUser({ preferences: prefs }).catch(() => {});
  }, SERVER_SYNC_DEBOUNCE_MS);
}

function persistLocal(prefs: UserPreferences) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  syncLegacyMapSettings(prefs);
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
}

/** Merge a patch into the stored preferences, notify listeners, sync to server. */
export function updatePreferences(patch: UserPreferences): UserPreferences {
  const next = mergePreferences(loadPreferences(), patch);
  persistLocal(next);
  scheduleServerSync();
  return next;
}

/**
 * Drop the signed-out account's preferences, keeping only what belongs to the
 * device rather than the person.
 *
 * Without this, the next account to sign in on this browser inherits the
 * previous one's map defaults, index choice and station selection — and worse,
 * adoptServerPreferences pushes that leftover local copy *up* to the new
 * account when the new account has none of its own. Theme survives because it
 * is a property of the screen you are looking at, not of the session.
 */
export function clearAccountPreferences() {
  if (!isBrowser()) return;
  const { theme } = loadPreferences();
  persistLocal({ ...DEFAULT_PREFERENCES, theme });
  // Deliberately no scheduleServerSync() — there is no account to sync to, and
  // pushing defaults would overwrite the preferences of the account just left.
}

/**
 * Called after login / session restore with the account's stored preferences.
 * Server copy wins when present; otherwise the local copy is pushed up once.
 */
export function adoptServerPreferences(server: UserPreferences | null | undefined) {
  if (!isBrowser()) return;
  if (server && Object.keys(server).length > 0) {
    persistLocal(mergePreferences(DEFAULT_PREFERENCES, server));
  } else if (localStorage.getItem(STORAGE_KEY)) {
    // Account has no saved preferences yet — adopt this browser's copy.
    scheduleServerSync();
  }
}

/** Resolve the effective theme. Only an explicit "system" consults the OS; unset defaults to light. */
export function resolveTheme(theme: ThemePreference | undefined): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "system") {
    return isBrowser() && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

/**
 * Apply the stored document-level preferences to <html>: the theme (adds or
 * removes `.dark`, which is what every `dark:` variant and the `.dark` token
 * block in globals.css key off) and the language.
 *
 * Mirrors the inline script in the root layout, which does the same thing
 * before first paint — keep the two in sync.
 */
export function applyPreferencesToDocument() {
  if (!isBrowser()) return;
  const prefs = loadPreferences();
  const resolved = resolveTheme(prefs.theme);
  const root = document.documentElement;

  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.lang = prefs.language ?? "en";
}

// ---- React subscription -------------------------------------------------

let cachedSnapshot: UserPreferences = DEFAULT_PREFERENCES;
let cachedRaw: string | null = null;

function getSnapshot(): UserPreferences {
  if (!isBrowser()) return DEFAULT_PREFERENCES;
  const raw = localStorage.getItem(STORAGE_KEY);
  // Return a referentially-stable object unless the stored JSON changed,
  // otherwise useSyncExternalStore loops on a fresh object every render.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = loadPreferences();
  }
  return cachedSnapshot;
}

function subscribe(onChange: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => onChange();
  window.addEventListener(PREFERENCES_CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/** Live view of the current preferences (re-renders on any change). */
export function usePreferences(): UserPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PREFERENCES);
}

/**
 * The air-quality index every surface reports against. Reading it through this
 * hook is what keeps map dots, popups, station cards and the legend from
 * disagreeing about what a given PM2.5 value means.
 */
export function useAqiStandard(): AqiStandard {
  return getAqiStandard(usePreferences().map?.aqiStandard);
}

/** Persist the reader's index choice (local first, then synced to the account). */
export function setAqiStandard(id: AqiStandard["id"]): void {
  updatePreferences({ map: { aqiStandard: id } });
}
