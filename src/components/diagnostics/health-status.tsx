"use client";

import { SensorHealthStatus } from "@/lib/api/types";

// Shared status presentation for sensor freshness — used by the diagnostics
// page and the map popups so the two never disagree.

export const STATUS_STYLES: Record<
  SensorHealthStatus,
  { label: string; badge: string; dot: string; hex: string }
> = {
  online: {
    label: "Online",
    badge: "bg-green-100 text-green-800 ring-green-600/20",
    dot: "bg-green-500",
    hex: "#22c55e",
  },
  stale: {
    label: "Stale",
    badge: "bg-amber-100 text-amber-800 ring-amber-600/20",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  offline: {
    label: "Offline",
    badge: "bg-red-100 text-red-800 ring-red-600/20",
    dot: "bg-red-500",
    hex: "#ef4444",
  },
  no_data: {
    label: "No data",
    badge: "bg-gray-100 text-gray-700 ring-gray-500/20",
    dot: "bg-gray-400",
    hex: "#9ca3af",
  },
};

/** Hours elapsed since an ISO timestamp; null when missing/invalid. */
export function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return (Date.now() - then) / 3_600_000;
}

/**
 * Client-side freshness from the latest reading timestamp. Mirrors the backend
 * thresholds in sensor_health_service.py (_ONLINE_MAX_HOURS / _STALE_MAX_HOURS)
 * so the map dot and the diagnostics page agree: online < 30 min, stale < 6 h,
 * otherwise offline; no reading at all → no_data (gray).
 */
export function freshnessStatus(lastSeenAt: string | null): SensorHealthStatus {
  const hours = hoursSince(lastSeenAt);
  if (hours === null) return "no_data";
  if (hours < 0.5) return "online";
  if (hours < 6) return "stale";
  return "offline";
}

/** Absolute "Last updated" label, e.g. "10 Jul 2026, 14:35". Null-safe. */
export function formatAbsoluteTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}, ${time}`;
}

/** Format hours-since-last-reading into a compact relative "last seen" label. */
export function formatLastSeen(hours: number | null, lastReading: string | null): string {
  if (lastReading === null || hours === null) return "never";
  if (hours < 0) return "just now";
  const minutes = hours * 60;
  if (minutes < 1) return "just now";
  if (hours < 1) return `${Math.round(minutes)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function StatusBadge({ status }: { status: SensorHealthStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.no_data;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
