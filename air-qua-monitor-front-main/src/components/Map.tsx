"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LoadingState } from "@/components/ui/loading-state";
import { Thermometer, Droplets, ArrowRight } from "lucide-react";
import { getLatestKPIs } from "@/lib/api/sensor-readings";
import { getLocations } from "@/lib/api/locations";
import {
  calculateAQI,
  getAQIStatus,
  getPM25Color,
  getPM25Level,
  joinKPIsWithLocations,
  buildMapStationsFromJoined,
  getAirQualityLevelColor,
  getAirQualityLevelTextColor,
  type MapStation,
} from "@/lib/utils/readings";

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

// Map dot color from backend air_quality_level, falling back to PM2.5
const createCircleIcon = (aqi: number, pm2_5: number, airQualityLevel?: string | null) => {
  const color = airQualityLevel
    ? getAirQualityLevelColor(airQualityLevel)
    : getPM25Color(pm2_5);
  const cacheKey = `${color}|${aqi}`;
  const cached = circleIconCache.get(cacheKey);
  if (cached) return cached;

  const size = 50; // Circle diameter
  const fontSize = aqi > 99 ? 14 : 16; // Smaller font for 3-digit numbers
  
  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: ${fontSize}px;
      cursor: pointer;
      pointer-events: auto;
      transition: transform 0.2s;
    ">
      ${aqi}
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
    const avgPm25 = group.reduce((sum, s) => sum + s.pm2_5, 0) / count;
    const avgPm10 = group.reduce((sum, s) => sum + s.pm10_0, 0) / count;
    const avgTemp = group.reduce((sum, s) => sum + s.temperature, 0) / count;
    const avgHum = group.reduce((sum, s) => sum + s.humidity, 0) / count;
    const avgAqi = calculateAQI(avgPm25, avgPm10);
    const status = getAQIStatus(avgAqi);

    clusters.push({
      id: `cluster-${key}`,
      name: `${count} stations in this area`,
      position: [avgLat, avgLng],
      aqi: avgAqi,
      status,
      airQualityLevel: status,
      pm2_5: avgPm25,
      pm10_0: avgPm10,
      humidity: avgHum,
      temperature: avgTemp,
      locationId: "",
      deviceId: "",
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

function formatMetric(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

// PM2.5 labels/colors match reference: Good 0–15, Moderate 15–35, Unhealthy (Sensitive) 35–55, Unhealthy 55+
function getParameterQuality(param: string, value: number) {
  if (param === "pm2_5") {
    const level = getPM25Level(value);
    if (level === "Good") return { label: "Good", color: "text-green-600" };
    if (level === "Moderate") return { label: "Moderate", color: "text-yellow-600" };
    if (level === "Unhealthy (Sensitive)") return { label: "Unhealthy (Sensitive)", color: "text-orange-600" };
    return { label: "Unhealthy", color: "text-red-600" };
  }
  if (param === "pm10_0") {
    if (value <= 20) return { label: "Good", color: "text-green-600" };
    if (value <= 50) return { label: "Moderate", color: "text-yellow-600" };
    if (value <= 100) return { label: "Unhealthy", color: "text-orange-600" };
    return { label: "Hazardous", color: "text-red-600" };
  }
  return { label: "Normal", color: "text-gray-600" };
}

// Memoized marker: popup open/close and map zoom state changes in the parent
// no longer recreate every marker on the map.
const StationMarker = memo(function StationMarker({ station }: { station: DisplayStation }) {
  const router = useRouter();
  const pm2_5Quality = getParameterQuality("pm2_5", station.pm2_5);
  const pm10_0Quality = getParameterQuality("pm10_0", station.pm10_0);
  const customIcon = createCircleIcon(station.aqi, station.pm2_5, station.airQualityLevel);
  const isCluster = !!station.clusterSize && station.clusterSize > 1;

  return (
    <Marker position={station.position} icon={customIcon}>
      <Popup className="station-popup" maxWidth={360}>
        <div className="station-popup-inner">
          <div className="station-popup-hero">
            <div
              className="station-popup-aqi"
              style={{
                backgroundColor: getAirQualityLevelColor(station.airQualityLevel),
                color: getAirQualityLevelTextColor(station.airQualityLevel),
              }}
            >
              <span className="station-popup-aqi-value">{station.aqi}</span>
              <span className="station-popup-aqi-label">AQI</span>
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
              <p className="station-popup-status">{station.status}</p>
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
                  router.push(`/stations?device=${station.deviceId}`);
                }}
                className="station-popup-link"
              >
                Details
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            )}
          </div>

          <div className="station-popup-metrics">
            <div className="station-popup-metric">
              <span className="station-popup-metric-label">PM2.5</span>
              <span className={`station-popup-metric-value ${pm2_5Quality.color}`}>
                {formatMetric(station.pm2_5)}
                <span className="station-popup-metric-unit">µg/m³</span>
              </span>
            </div>
            <div className="station-popup-metric">
              <span className="station-popup-metric-label">PM10</span>
              <span className={`station-popup-metric-value ${pm10_0Quality.color}`}>
                {formatMetric(station.pm10_0)}
                <span className="station-popup-metric-unit">µg/m³</span>
              </span>
            </div>
            <div className="station-popup-metric station-popup-metric--weather">
              <Thermometer className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              <span className="station-popup-metric-value text-foreground">
                {formatMetric(station.temperature)}°C
              </span>
            </div>
            <div className="station-popup-metric station-popup-metric--weather">
              <Droplets className="h-3.5 w-3.5 text-blue-500" aria-hidden />
              <span className="station-popup-metric-value text-foreground">
                {formatMetric(station.humidity)}%
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
  }, []);

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
        const [locations, kpiData] = await Promise.all([
          getLocations(),
          getLatestKPIs(),
        ]);
        const joined = joinKPIsWithLocations(kpiData, locations);
        const stationsData = buildMapStationsFromJoined(joined);

        if (stationsData.length === 0) {
          setInternalStations([]);
          return;
        }

        const center = centerFromStations(stationsData);
        if (center) setMapCenter(center);
        setInternalStations(stationsData);
      } catch (err: any) {
        console.error("Error fetching map data:", err);
        let errorMessage = "Failed to load map data";
        if (err?.detail) {
          errorMessage = err.detail;
        } else if (err?.message) {
          errorMessage = err.message;
        } else if (typeof err === "string") {
          errorMessage = err;
        }
        if (errorMessage.includes("Not Found") || err?.status === 404) {
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
          <StationMarker key={station.id} station={station} />
        ))}
      </MapContainer>

      {/* PM2.5 color legend */}
      <div
        className={
          fullscreen
            ? "pointer-events-none absolute bottom-4 right-4 mb-14 bg-card/95 backdrop-blur rounded-lg border border-border shadow-md px-3 py-2 text-[11px] text-foreground/80 space-y-1"
            : "pointer-events-none absolute bottom-4 right-4 bg-card/95 backdrop-blur rounded-lg border border-border shadow-md px-3 py-2 text-[11px] text-foreground/80 space-y-1"
        }
      >
        <p className="font-semibold text-[11px] text-foreground">PM2.5 dot colors (µg/m³)</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span>0–15 Good</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
            <span>15–35 Moderate</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span>35–55 Unhealthy (SG)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            <span>55+ Unhealthy</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Map = memo(MapComponent);
