"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LoadingState } from "@/components/ui/loading-state";
import { Thermometer, Droplets, ArrowRight } from "lucide-react";
import { getPublicMapKPIs } from "@/lib/api/sensor-readings";
import { getSensorHealth } from "@/lib/api/sensor-health";
import { SensorHealthStation } from "@/lib/api/types";
import {
  STATUS_STYLES,
  StatusBadge,
  formatAbsoluteTimestamp,
  formatLastSeen,
  freshnessStatus,
  hoursSince,
} from "@/components/diagnostics/health-status";
import { useAuthStore } from "@/store/authStore";
import {
  averageDefined,
  formatMetricValue,
  embeddedKpisToJoined,
  buildMapStationsFromJoined,
  type MapStation,
} from "@/lib/utils/readings";
import {
  AqiReading,
  AqiStandard,
  categoryRangeLabel,
  evaluateAqi,
} from "@/lib/utils/aqi-standards";
import { useAqiStandard } from "@/lib/preferences";
import { AqiStandardSelector } from "@/components/map/AqiStandardSelector";

interface MapSettings {
  defaultZoom: number;
  defaultLocation: {
    lat: number | null;
    lng: number | null;
  } | null;
}

// Module-level icon cache: icons only vary by color + displayed AQI value, so
// reuse L.divIcon instances across renders instead of recreating one per
// marker per render.
const circleIconCache = new globalThis.Map<string, L.DivIcon>();

// Map dot color and value both come from the reader's selected AQI standard,
// so the bubble can never disagree with the popup or the legend.
// statusHex adds a small freshness dot on the rim; faded dims the whole
// bubble for stations whose data is outdated (offline / no data).
const createCircleIcon = (
  aqi: AqiReading,
  textColor: string,
  statusHex?: string,
  faded = false
) => {
  const color = aqi.color;
  // A station with no PM2.5 reading shows an em dash, not a fabricated 0.
  const label = aqi.display;
  const cacheKey = `${color}|${textColor}|${label}|${statusHex ?? ""}|${faded ? "f" : ""}`;
  const cached = circleIconCache.get(cacheKey);
  if (cached) return cached;

  const size = 50; // Circle diameter
  const fontSize = label.length > 3 ? 13 : label.length > 2 ? 14 : 16;

  const statusDot = statusHex
    ? `<span style="
        position: absolute;
        top: -1px;
        right: -1px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background-color: ${statusHex};
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.35);
      "></span>`
    : "";

  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${textColor};
      font-weight: bold;
      font-size: ${fontSize}px;
      cursor: pointer;
      pointer-events: auto;
      transition: transform 0.2s;
      ${faded ? "opacity: 0.55; filter: saturate(0.6);" : ""}
    ">
      ${label}${statusDot}
    </div>
  `;

  const icon = L.divIcon({
    html: html,
    className: "custom-circle-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
  circleIconCache.set(cacheKey, icon);
  return icon;
};

interface MapProps {
  fullscreen?: boolean;
  /** When set, Map uses parent data and skips its own fetch */
  stations?: MapStation[];
  loading?: boolean;
}

type DisplayStation = MapStation & {
  clusterSize?: number;
  stationNames?: string[];
};

function ZoomSync({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend: (e) => {
      const z = e.target.getZoom();
      if (typeof z === "number") {
        onZoomChange(z);
      }
    },
  });
  return null;
}

function getDisplayStations(items: MapStation[], zoom: number): DisplayStation[] {
  if (zoom >= 12) {
    return items;
  }

  let cellSize = 0.1;
  if (zoom <= 8) {
    cellSize = 0.4;
  } else if (zoom <= 10) {
    cellSize = 0.25;
  } else if (zoom <= 12) {
    cellSize = 0.15;
  }

  const buckets: globalThis.Map<string, MapStation[]> = new globalThis.Map();

  items.forEach((s) => {
    const lat = s.position[0];
    const lng = s.position[1];
    const latKey = Math.round(lat / cellSize);
    const lngKey = Math.round(lng / cellSize);
    const key = `${latKey}-${lngKey}`;
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  });

  const clusters: DisplayStation[] = [];

  buckets.forEach((group, key) => {
    if (group.length === 1) {
      clusters.push(group[0]);
      return;
    }

    const count = group.length;
    const avgLat = group.reduce((sum, s) => sum + s.position[0], 0) / count;
    const avgLng = group.reduce((sum, s) => sum + s.position[1], 0) / count;
    // Cluster metrics average only the stations that actually reported. Counting
    // a silent station as 0 dragged whole-cluster AQI down toward "Good".
    clusters.push({
      id: `cluster-${key}`,
      name: `${count} stations in this area`,
      position: [avgLat, avgLng],
      pm1_0: averageDefined(group.map((s) => s.pm1_0)),
      pm2_5: averageDefined(group.map((s) => s.pm2_5)),
      pm10_0: averageDefined(group.map((s) => s.pm10_0)),
      humidity: averageDefined(group.map((s) => s.humidity)),
      temperature: averageDefined(group.map((s) => s.temperature)),
      locationId: "",
      deviceId: "",
      lastSeenAt: null,
      clusterSize: count,
      stationNames: group.map((s) => s.name),
    });
  });

  return clusters;
}

function centerFromStations(stations: MapStation[]): [number, number] | null {
  if (stations.length === 0) return null;
  const avgLat = stations.reduce((sum, s) => sum + s.position[0], 0) / stations.length;
  const avgLng = stations.reduce((sum, s) => sum + s.position[1], 0) / stations.length;
  return [avgLat, avgLng];
}

/**
 * PM1.0 has no published index of its own, so it is shown as a plain number.
 * Only PM2.5 is colored, and its color comes from the selected standard so the
 * popup value and the map dot always tell the same story.
 */
function pm25TextStyle(aqi: AqiReading): React.CSSProperties | undefined {
  return aqi.category ? { color: aqi.color } : undefined;
}

// Memoized marker: popup open/close and map zoom state changes in the parent
// no longer recreate every marker on the map.
const StationMarker = memo(function StationMarker({
  station,
  standard,
  health,
}: {
  station: DisplayStation;
  /** The reader's selected index — drives the dot, the value and the category. */
  standard: AqiStandard;
  /** Admin-only sensor-health overlay for this device (undefined otherwise). */
  health?: SensorHealthStation;
}) {
  const router = useRouter();
  // Subscribed here rather than passed down so the memo boundary still holds:
  // markers only re-render when auth actually flips.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const aqi = evaluateAqi(standard, station.pm2_5);
  const isCluster = !!station.clusterSize && station.clusterSize > 1;
  // Freshness for the corner dot: admin health data when present, otherwise
  // derived from the station's latest reading timestamp (works for everyone).
  const freshness = isCluster
    ? null
    : health?.status ?? freshnessStatus(station.lastSeenAt);
  const statusHex = freshness
    ? (STATUS_STYLES[freshness] ?? STATUS_STYLES.no_data).hex
    : undefined;
  // Outdated stations (offline / never reported) render faded so the map
  // doesn't present stale values as live.
  const faded = freshness === "offline" || freshness === "no_data";
  const customIcon = createCircleIcon(aqi, aqi.textColor, statusHex, faded);

  return (
    <Marker position={station.position} icon={customIcon}>
      <Popup className="station-popup" maxWidth={360}>
        <div className="station-popup-inner">
          <div className="station-popup-hero">
            <div
              className="station-popup-aqi"
              style={{ backgroundColor: aqi.color, color: aqi.textColor }}
              title={`${standard.name} — ${aqi.label}. ${standard.attribution} ${standard.methodology}`}
            >
              <span className="station-popup-aqi-value">{aqi.display}</span>
              <span className="station-popup-aqi-label">{standard.valueLabel}</span>
            </div>

            <div className="station-popup-info">
              <h3 className="station-popup-title">
                {station.name}
                {isCluster && station.clusterSize && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    ({station.clusterSize})
                  </span>
                )}
              </h3>
              <p className="station-popup-status">{aqi.label}</p>
              {isCluster && station.stationNames && (
                <p className="station-popup-cluster-names">
                  {station.stationNames.slice(0, 3).join(", ")}
                  {station.stationNames.length > 3 && "…"}
                </p>
              )}
            </div>

            {!isCluster && (
              <button
                type="button"
                onClick={() => {
                  // /stations is behind auth, and this map also renders on the
                  // public landing page — so an anonymous visitor is sent to
                  // sign in carrying the station they clicked, rather than
                  // being bounced to a bare login page and losing it.
                  const target = `/stations?device=${station.deviceId}`;
                  router.push(
                    isAuthenticated
                      ? target
                      : `/login?next=${encodeURIComponent(target)}`
                  );
                }}
                className="station-popup-link"
              >
                Details
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            )}
          </div>

          {freshness && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <StatusBadge status={freshness} />
              <span title="Timestamp of the most recent reading">
                Last updated:{" "}
                {formatAbsoluteTimestamp(health?.last_reading ?? station.lastSeenAt)}
                {" ("}
                {formatLastSeen(
                  health?.hours_since_last ?? hoursSince(station.lastSeenAt),
                  health?.last_reading ?? station.lastSeenAt
                )}
                {")"}
              </span>
            </div>
          )}

          <div className="station-popup-metrics">
            <div className="station-popup-metric">
              <span className="station-popup-metric-label">PM1.0</span>
              <span className="station-popup-metric-value text-foreground">
                {formatMetricValue(station.pm1_0)}
                <span className="station-popup-metric-unit">µg/m³</span>
              </span>
            </div>
            <div className="station-popup-metric">
              <span className="station-popup-metric-label">PM2.5</span>
              <span className="station-popup-metric-value" style={pm25TextStyle(aqi)}>
                {formatMetricValue(station.pm2_5)}
                <span className="station-popup-metric-unit">µg/m³</span>
              </span>
            </div>
            <div className="station-popup-metric station-popup-metric--weather">
              <Thermometer className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              <span className="station-popup-metric-value text-foreground">
                {station.temperature === null ? "—" : `${formatMetricValue(station.temperature)}°C`}
              </span>
            </div>
            <div className="station-popup-metric station-popup-metric--weather">
              <Droplets className="h-3.5 w-3.5 text-blue-500" aria-hidden />
              <span className="station-popup-metric-value text-foreground">
                {station.humidity === null ? "—" : `${formatMetricValue(station.humidity)}%`}
              </span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

export function MapComponent({ fullscreen = false, stations: externalStations, loading: externalLoading }: MapProps) {
  const isControlled = externalStations !== undefined;
  const controlledCenterSet = useRef(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([9.0333, 38.7500]);
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [internalStations, setInternalStations] = useState<MapStation[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  // The index every dot, popup and legend entry on this map reports against.
  const standard = useAqiStandard();
  // Admin-only diagnostics overlay: sensor health keyed by device_id
  const isAdmin = useAuthStore((state) => state.user?.role === "admin");
  const [healthByDevice, setHealthByDevice] = useState<Record<string, SensorHealthStation>>({});

  const stations = isControlled ? externalStations : internalStations;
  const isLoading = isControlled ? (externalLoading ?? false) : internalLoading;

  const loadMapSettings = () => {
    const savedSettings = localStorage.getItem("mapSettings");
    if (savedSettings) {
      try {
        const settings: MapSettings = JSON.parse(savedSettings);
        if (settings.defaultZoom) {
          setMapZoom(settings.defaultZoom);
        }
        if (
          settings.defaultLocation &&
          settings.defaultLocation.lat !== null &&
          settings.defaultLocation.lng !== null
        ) {
          setMapCenter([settings.defaultLocation.lat, settings.defaultLocation.lng]);
        }
      } catch (err) {
        console.error("Error loading map settings:", err);
      }
    }
  };

  useEffect(() => {
    setIsClient(true);
    loadMapSettings();

    // React to settings changes in all modes (controlled maps included) —
    // the labels toggle and zoom/center must apply without a reload.
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "mapSettings") loadMapSettings();
    };
    const handleCustomStorageChange = () => loadMapSettings();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("mapSettingsChanged", handleCustomStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("mapSettingsChanged", handleCustomStorageChange);
    };
  }, []);

  // Best-effort health overlay for admins (status dot + popup diagnostics row).
  useEffect(() => {
    if (!isAdmin) {
      setHealthByDevice({});
      return;
    }
    let cancelled = false;
    getSensorHealth()
      .then((res) => {
        if (cancelled) return;
        const byDevice: Record<string, SensorHealthStation> = {};
        for (const s of res.stations) byDevice[s.device_id] = s;
        setHealthByDevice(byDevice);
      })
      .catch(() => {
        // Overlay only — the map works fine without it.
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isControlled || externalStations.length === 0) return;
    if (controlledCenterSet.current) return;
    const center = centerFromStations(externalStations);
    if (center) {
      setMapCenter(center);
      controlledCenterSet.current = true;
    }
  }, [isControlled, externalStations]);
  useEffect(() => {
    if (isControlled) return;

    const fetchData = async () => {
      setInternalLoading(true);
      setError(null);

      try {
        const kpiData = await getPublicMapKPIs();
        const joined = embeddedKpisToJoined(kpiData);
        const stationsData = buildMapStationsFromJoined(joined);

        if (stationsData.length === 0) {
          setInternalStations([]);
          return;
        }

        const center = centerFromStations(stationsData);
        if (center) setMapCenter(center);
        setInternalStations(stationsData);
      } catch (err: unknown) {
        console.error("Error fetching map data:", err);
        const errObj = (err ?? {}) as { detail?: string; message?: string; status?: number };
        let errorMessage = "Failed to load map data";
        if (typeof errObj.detail === "string" && errObj.detail) {
          errorMessage = errObj.detail;
        } else if (typeof errObj.message === "string" && errObj.message) {
          errorMessage = errObj.message;
        } else if (typeof err === "string") {
          errorMessage = err;
        }
        if (errorMessage.includes("Not Found") || errObj.status === 404) {
          errorMessage =
            "API endpoint not found. Please check if the backend is running and the endpoint exists.";
        }
        setError(errorMessage);
      } finally {
        setInternalLoading(false);
      }
    };

    fetchData();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "mapSettings") loadMapSettings();
    };
    const handleCustomStorageChange = () => loadMapSettings();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("mapSettingsChanged", handleCustomStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("mapSettingsChanged", handleCustomStorageChange);
    };
  }, [isControlled]);


  // Clustering only recomputes when stations or zoom actually change, not on
  // every parent render.
  const displayStations = useMemo(
    () => getDisplayStations(stations, mapZoom),
    [stations, mapZoom]
  );

  if (!isClient) {
    return null;
  }

  const shellClass = fullscreen
    ? "w-full h-full relative overflow-hidden bg-muted"
    : "w-full h-full relative rounded-2xl border border-border shadow-xl bg-muted";

  const panelClass = fullscreen
    ? "w-full h-full flex items-center justify-center bg-muted"
    : "w-full h-full flex items-center justify-center bg-card rounded-2xl border border-border shadow-lg";

  if (isLoading) {
    return (
      <div className={panelClass}>
        <LoadingState
          fill
          variant={fullscreen ? "overlay" : "page"}
          message="Loading city map and stations"
          hint="Fetching live air quality readings from monitoring stations"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={panelClass}>
        <div className="text-center p-6 max-w-md">
          <p className="text-destructive mb-2 font-semibold text-sm">Unable to load map data</p>
          <p className="text-xs text-muted-foreground mb-4">{error}</p>
          {error.includes('CORS') && (
            <p className="text-xs text-muted-foreground/80 mt-2">
              This may be a CORS configuration issue. See CORS_SETUP.md for backend configuration.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Only render map when we have stations data
  if (stations.length === 0) {
    return (
      <div className={panelClass}>
        <div className="text-center">
          <p className="text-muted-foreground text-sm">No station data available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <ZoomControl position={fullscreen ? "bottomright" : "topleft"} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomSync onZoomChange={setMapZoom} />
        {displayStations.map((station) => (
          <StationMarker
            key={station.id}
            station={station}
            standard={standard}
            health={healthByDevice[station.deviceId]}
          />
        ))}
      </MapContainer>

      {/*
        AQI standard picker, top-left, outside <MapContainer> so Leaflet never
        receives the clicks. Offset past Leaflet's own top-left zoom control.
        The fullscreen map page renders its own copy inside MapPageChrome's
        top-left stack instead, so it can sit under the branding card without
        either one guessing the other's height.
      */}
      {!fullscreen && (
        <div className="absolute left-14 top-3 z-[1000]">
          <AqiStandardSelector standard={standard} />
        </div>
      )}

      {/* Dot-color legend for the selected standard (PM2.5 µg/m³ bands) */}
      <div
        className={
          fullscreen
            ? "pointer-events-none absolute bottom-4 right-4 mb-14 max-w-[15rem] bg-card/95 backdrop-blur rounded-lg border border-border shadow-md px-3 py-2 text-[11px] text-foreground/80 space-y-1"
            : "pointer-events-none absolute bottom-4 right-4 max-w-[15rem] bg-card/95 backdrop-blur rounded-lg border border-border shadow-md px-3 py-2 text-[11px] text-foreground/80 space-y-1"
        }
      >
        <p className="font-semibold text-[11px] text-foreground">
          {standard.shortName} · PM2.5 (µg/m³)
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {standard.categories.map((category, index) => (
            <div key={category.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="truncate" title={`${categoryRangeLabel(standard, index)} ${category.label}`}>
                {categoryRangeLabel(standard, index)} {category.shortLabel}
              </span>
            </div>
          ))}
        </div>
        {/*
          These category names are the standards body's wording, so the body is
          credited here rather than only inside the picker — and the methodology
          note says where our live figure departs from the published method.
        */}
        <p
          className="border-t border-border/60 pt-1.5 text-[10px] leading-snug text-muted-foreground"
          title={`${standard.attribution} ${standard.methodology}`}
        >
          Scale: {standard.source}. Live PM2.5, not a 24-hour average.
        </p>
      </div>
    </div>
  );
}

export const Map = memo(MapComponent);
