"use client";

import { cn } from "@/lib/utils";
import {
  getAirQualityLevelBadgeClass,
  getAirQualityLevelColor,
  getAirQualityLevelTextColor,
  type MapStation,
} from "@/lib/utils/readings";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Droplets,
  MapPin,
  Thermometer,
} from "lucide-react";

export interface StationExplorerEntry extends MapStation {
  description?: string | null;
  serialNumber?: string;
  recordedAt?: string;
  deviceStatus?: "active" | "offline" | "maintenance";
}

interface StationExplorerCardProps {
  station: StationExplorerEntry;
  selected?: boolean;
  onSelect: (station: StationExplorerEntry) => void;
  onViewAnalytics: (deviceId: string) => void;
}

function formatRecordedAt(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StationExplorerCard({
  station,
  selected,
  onSelect,
  onViewAnalytics,
}: StationExplorerCardProps) {
  const aqiColor = getAirQualityLevelColor(station.airQualityLevel);
  const aqiTextColor = getAirQualityLevelTextColor(station.airQualityLevel);
  const statusClass = getAirQualityLevelBadgeClass(station.airQualityLevel);

  return (
    <article
      id={`station-card-${station.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(station)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(station);
        }
      }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary/50 ring-2 ring-primary/20 shadow-md"
          : "border-border/80 hover:border-primary/30"
      )}
    >
      <div className="flex items-stretch gap-0 border-b border-border/60">
        <div
          className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center py-4"
          style={{ backgroundColor: aqiColor, color: aqiTextColor }}
        >
          <span className="text-2xl font-bold tabular-nums leading-none">{station.aqi}</span>
          <span className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wider opacity-90">
            AQI
          </span>
        </div>
        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold text-foreground">{station.name}</h3>
            <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", statusClass)}>
              {station.status}
            </span>
          </div>
          {station.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{station.description}</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Updated {formatRecordedAt(station.recordedAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-4">
        {[
          { label: "PM2.5", value: `${station.pm2_5.toFixed(1)}`, unit: "µg/m³", icon: Activity },
          { label: "PM10", value: `${station.pm10_0.toFixed(1)}`, unit: "µg/m³", icon: Activity },
          {
            label: "Temp",
            value: `${station.temperature.toFixed(1)}°C`,
            unit: "",
            icon: Thermometer,
          },
          {
            label: "Humidity",
            value: `${station.humidity.toFixed(1)}%`,
            unit: "",
            icon: Droplets,
          },
        ].map(({ label, value, unit, icon: Icon }) => (
          <div key={label} className="bg-card px-3 py-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon className="h-3 w-3" aria-hidden />
              {label}
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
              {value}
              {unit && <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewAnalytics(station.deviceId);
          }}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#016fc4] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#015a9e]"
        >
          Full analytics
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </article>
  );
}

interface StationDetailPanelProps {
  station: StationExplorerEntry | null;
  currentIndex?: number;
  totalCount?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onViewAnalytics: (deviceId: string) => void;
  onViewMap: () => void;
}

export function StationDetailPanel({
  station,
  currentIndex = 0,
  totalCount = 0,
  onPrevious,
  onNext,
  onViewAnalytics,
  onViewMap,
}: StationDetailPanelProps) {
  if (!station) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-10 text-center">
        <MapPin className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">Select a station</p>
        <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">
          Click any card to see location details and the latest reading summary.
        </p>
      </div>
    );
  }

  const aqiColor = getAirQualityLevelColor(station.airQualityLevel);
  const canGoPrev = totalCount > 1 && currentIndex > 0;
  const canGoNext = totalCount > 1 && currentIndex < totalCount - 1;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="px-5 py-4 text-white" style={{ backgroundColor: aqiColor }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">
              Station details
              {totalCount > 1 && (
                <span className="ml-2 normal-case tracking-normal opacity-80">
                  · {currentIndex + 1} of {totalCount}
                </span>
              )}
            </p>
            <h2 className="mt-1 truncate text-xl font-bold">{station.name}</h2>
            <p className="mt-1 text-sm opacity-90">{station.status} · AQI {station.aqi}</p>
          </div>
          {totalCount > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onPrevious}
                disabled={!canGoPrev}
                aria-label="Previous station"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!canGoNext}
                aria-label="Next station"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 p-5">
        {station.description && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              About this location
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{station.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Coordinates</p>
            <p className="mt-0.5 font-mono text-xs tabular-nums">
              {station.position[0].toFixed(4)}, {station.position[1].toFixed(4)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Device status</p>
            <p className="mt-0.5 capitalize">{station.deviceStatus ?? "active"}</p>
          </div>
          {station.serialNumber && (
            <div className="col-span-2 rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Serial number</p>
              <p className="mt-0.5 font-mono text-xs">{station.serialNumber}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Latest reading
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">PM2.5</dt>
              <dd className="font-bold tabular-nums">{station.pm2_5.toFixed(1)} µg/m³</dd>
            </div>
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">PM10</dt>
              <dd className="font-bold tabular-nums">{station.pm10_0.toFixed(1)} µg/m³</dd>
            </div>
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Temperature</dt>
              <dd className="font-bold tabular-nums">{station.temperature.toFixed(1)}°C</dd>
            </div>
            <div className="rounded-lg border border-border/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Humidity</dt>
              <dd className="font-bold tabular-nums">{station.humidity.toFixed(1)}%</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 p-4 sm:flex-row">
        <button
          type="button"
          onClick={() => onViewAnalytics(station.deviceId)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#016fc4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#015a9e]"
        >
          Open full analytics
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onViewMap}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50"
        >
          View on map
        </button>
      </div>
    </div>
  );
}
