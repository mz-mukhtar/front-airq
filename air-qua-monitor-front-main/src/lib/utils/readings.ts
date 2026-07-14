import { SensorReading, Location, PublicReadingKPI } from '@/lib/api/types';
import { dedupeAsync } from '@/lib/api/dedupe';

export interface JoinedKPIReading extends PublicReadingKPI {
  location_name: string;
  location_latitude: number;
  location_longitude: number;
  location_description?: string | null;
}

/** Station shape shared by Map and landing station cards */
export interface MapStation {
  id: string;
  name: string;
  position: [number, number];
  aqi: number;
  status: string;
  airQualityLevel: string;
  pm2_5: number;
  pm10_0: number;
  humidity: number;
  temperature: number;
  locationId: string;
  deviceId: string;
}

/** Build deduplicated map/card stations from joined KPI + location rows */
export function buildMapStationsFromJoined(joined: JoinedKPIReading[]): MapStation[] {
  const seenDevices = new Set<string>();

  return joined
    .filter((item) => {
      const uniqueKey = `${item.location_id}-${item.device_id}`;
      if (seenDevices.has(uniqueKey)) return false;
      seenDevices.add(uniqueKey);
      return true;
    })
    .map((item) => {
      const pm25 = item.pm2_5 ?? 0;
      const pm10 = item.pm10 ?? 0;
      const temperature = item.temperature ?? 22;
      const humidity = item.humidity ?? 60;
      const aqi = calculateAQI(pm25, pm10);
      const airQualityLevel = normalizeAirQualityLevel(
        item.air_quality_level ?? getAQIStatus(aqi)
      );

      return {
        id: `${item.location_id}-${item.device_id}`,
        name: item.location_name,
        position: [item.location_latitude, item.location_longitude] as [number, number],
        aqi,
        status: airQualityLevel,
        airQualityLevel,
        pm2_5: pm25,
        pm10_0: pm10,
        humidity,
        temperature,
        locationId: item.location_id!,
        deviceId: item.device_id,
      };
    });
}

/** Fetch locations + latest KPIs once, with join applied (deduped) */
export async function fetchPublicDashboardData(): Promise<{
  locations: Location[];
  kpis: PublicReadingKPI[];
  joined: JoinedKPIReading[];
  stations: MapStation[];
}> {
  return dedupeAsync("public-dashboard-data", async () => {
    const { getLocations } = await import("@/lib/api/locations");
    const { getLatestKPIs } = await import("@/lib/api/sensor-readings");

    const [locations, kpis] = await Promise.all([getLocations(), getLatestKPIs()]);
    const joined = joinKPIsWithLocations(kpis, locations);
    const stations = buildMapStationsFromJoined(joined);

    return { locations, kpis, joined, stations };
  });
}

/** Join slim KPI rows with location metadata for map/card display */
export function joinKPIsWithLocations(
  kpis: PublicReadingKPI[],
  locations: Location[]
): JoinedKPIReading[] {
  const locMap = new Map(locations.map((l) => [l.id, l]));

  return kpis
    .filter((kpi) => kpi.location_id && locMap.has(kpi.location_id))
    .map((kpi) => {
      const loc = locMap.get(kpi.location_id!)!;
      return {
        ...kpi,
        location_name: loc.name,
        location_latitude: loc.latitude,
        location_longitude: loc.longitude,
        location_description: loc.description,
      };
    });
}

/** Normalize backend air_quality_level strings for display */
export function normalizeAirQualityLevel(level: string | null | undefined): string {
  if (!level) return "Unknown";
  const lower = level.toLowerCase();
  if (lower === "good") return "Good";
  if (lower === "moderate") return "Moderate";
  if (lower.includes("sensitive")) return "Unhealthy for Sensitive Groups";
  if (lower === "unhealthy") return "Unhealthy";
  if (lower.includes("very")) return "Very Unhealthy";
  if (lower === "hazardous") return "Hazardous";
  return level;
}

/** Tailwind badge classes for air quality level */
export function getAirQualityLevelBadgeClass(level: string | null | undefined): string {
  switch (normalizeAirQualityLevel(level)) {
    case "Good":
      return "text-green-600 bg-green-50";
    case "Moderate":
      return "text-yellow-600 bg-yellow-50";
    case "Unhealthy for Sensitive Groups":
      return "text-orange-600 bg-orange-50";
    case "Unhealthy":
      return "text-red-600 bg-red-50";
    case "Very Unhealthy":
      return "text-purple-600 bg-purple-50";
    case "Hazardous":
      return "text-purple-800 bg-purple-100";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

/** Text color for AQI on colored backgrounds (WAQI-style contrast) */
export function getAirQualityLevelTextColor(level: string | null | undefined): string {
  switch (normalizeAirQualityLevel(level)) {
    case "Moderate":
      return "#1f2937";
    default:
      return "#ffffff";
  }
}

/** Hex color for map dots from backend air_quality_level */
export function getAirQualityLevelColor(level: string | null | undefined): string {
  switch (normalizeAirQualityLevel(level)) {
    case "Good":
      return "#22c55e";
    case "Moderate":
      return "#eab308";
    case "Unhealthy for Sensitive Groups":
      return "#f97316";
    case "Unhealthy":
      return "#dc2626";
    case "Very Unhealthy":
      return "#9333ea";
    case "Hazardous":
      return "#7f1d1d";
    default:
      return "#6b7280";
  }
}

// Extract value from reading_value with multiple possible keys
// Handles both flat structure (reading.pm2_5) and nested structure (reading.reading_value.pm2_5)
// Missing values collapse to 0 — use extractReadingValueOrNull where "no data" matters.
export function extractReadingValue(reading: SensorReading | any, keys: string[]): number {
  return extractReadingValueOrNull(reading, keys) ?? 0;
}

// Like extractReadingValue, but returns null when the value is genuinely missing
// so "no data" isn't conflated with a measured zero (table/CSV paths).
export function extractReadingValueOrNull(reading: SensorReading | any, keys: string[]): number | null {
  // First try flat structure (for /latest endpoint responses)
  for (const key of keys) {
    const flatValue = (reading as any)[key];
    if (flatValue !== undefined && flatValue !== null) {
      if (typeof flatValue === 'number') return flatValue;
      if (typeof flatValue === 'string') {
        const parsed = parseFloat(flatValue);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }

  // Then try nested structure (for standard sensor readings)
  if (reading.reading_value && typeof reading.reading_value === 'object') {
    for (const key of keys) {
      const value = reading.reading_value[key];
      if (value !== undefined && value !== null) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
  }

  return null;
}

// Extract timestamp from reading (prioritizes recorded_at, then timestamp_ms, falls back to created_at)
// Handles both flat structure and nested structure
export function extractTimestamp(reading: SensorReading | any): number {
  // Prioritize recorded_at (flat structure) - this is the actual measurement time
  if ((reading as any).recorded_at) {
    const recordedAt = (reading as any).recorded_at;
    if (typeof recordedAt === 'string') {
      const date = new Date(recordedAt);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }
  
  // Try flat structure (timestamp_ms directly on reading)
  const flatTimestampMs = (reading as any).timestamp_ms;
  if (flatTimestampMs !== undefined && flatTimestampMs !== null) {
    if (typeof flatTimestampMs === 'number') return flatTimestampMs;
    if (typeof flatTimestampMs === 'string') {
      const parsed = parseInt(flatTimestampMs, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  
  // Try nested structure (timestamp_ms in reading_value)
  if (reading.reading_value && typeof reading.reading_value === 'object') {
    const timestampMs = reading.reading_value.timestamp_ms;
    if (timestampMs !== undefined && timestampMs !== null) {
      if (typeof timestampMs === 'number') return timestampMs;
      if (typeof timestampMs === 'string') {
        const parsed = parseInt(timestampMs, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }
  
  // Fallback to created_at converted to milliseconds
  if (reading.created_at) {
    return new Date(reading.created_at).getTime();
  }
  
  return Date.now();
}

// US EPA AQI breakpoints (May 2024 update). Rows: [Clo, Chi, AQIlo, AQIhi].
const PM25_AQI_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0.0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
];

const PM10_AQI_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0, 54, 0, 50],
  [55, 154, 51, 100],
  [155, 254, 101, 150],
  [255, 354, 151, 200],
  [355, 424, 201, 300],
  [425, 604, 301, 500],
];

/** Piecewise-linear sub-index: AQI = (AQIhi−AQIlo)/(Chi−Clo) × (C−Clo) + AQIlo, rounded. */
function aqiSubIndex(
  concentration: number | null | undefined,
  breakpoints: Array<[number, number, number, number]>,
  truncate: (c: number) => number
): number | null {
  if (concentration === null || concentration === undefined || !Number.isFinite(concentration)) {
    return null;
  }
  // Negative sensor readings are treated as 0 for AQI purposes
  const c = truncate(Math.max(0, concentration));

  for (const [cLo, cHi, aqiLo, aqiHi] of breakpoints) {
    if (c <= cHi) {
      return Math.round(((aqiHi - aqiLo) / (cHi - cLo)) * (c - cLo) + aqiLo);
    }
  }
  // Beyond the top band ("Beyond the AQI"): clamp at 500
  return 500;
}

// Dashboard "AQI": interim product decision — display the raw PM2.5
// concentration (µg/m³) as the AQI value. Switch to calculateEpaAqi below
// when the real index calculation is adopted.
export function calculateAQI(pm25: number, _pm10: number): number {
  if (!Number.isFinite(pm25)) return 0;
  return Math.round(Math.max(0, pm25));
}

// Full US EPA AQI from PM2.5 and PM10 concentrations (µg/m³), May-2024
// breakpoints. Note: computed from instantaneous concentrations, so this is a
// dashboard approximation of the official 24h-average index.
export function calculateEpaAqi(pm25: number, pm10: number): number {
  // EPA truncation rules: PM2.5 to 1 decimal, PM10 to integer
  const aqiPm25 = aqiSubIndex(pm25, PM25_AQI_BREAKPOINTS, (c) => Math.floor(c * 10) / 10);
  const aqiPm10 = aqiSubIndex(pm10, PM10_AQI_BREAKPOINTS, (c) => Math.floor(c));

  // Overall AQI is the max of the pollutant sub-indices (ignoring missing inputs)
  if (aqiPm25 === null && aqiPm10 === null) return 0;
  return Math.max(aqiPm25 ?? 0, aqiPm10 ?? 0);
}

// Get AQI status (full EPA category set)
export function getAQIStatus(
  aqi: number
): "Good" | "Moderate" | "Unhealthy for Sensitive Groups" | "Unhealthy" | "Very Unhealthy" | "Hazardous" {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

// PM2.5-based air quality levels and colors (reference: Air Quality Levels table for map dots)
// Ranges: Good 0–15, Moderate 15–35, Unhealthy (Sensitive) 35–55, Unhealthy 55+
export type PM25Level = "Good" | "Moderate" | "Unhealthy (Sensitive)" | "Unhealthy";

export function getPM25Level(pm25: number): PM25Level {
  if (pm25 <= 15) return "Good";
  if (pm25 <= 35) return "Moderate";
  if (pm25 <= 55) return "Unhealthy (Sensitive)";
  return "Unhealthy";
}

/** Returns hex color for map dots and indicators per PM2.5 (µg/m³): Green / Yellow / Orange / Red */
export function getPM25Color(pm25: number): string {
  if (pm25 <= 15) return "#22c55e"; // Light green – Good
  if (pm25 <= 35) return "#eab308"; // Golden yellow – Moderate
  if (pm25 <= 55) return "#f97316"; // Orange – Unhealthy (Sensitive)
  return "#dc2626";                // Deep red – Unhealthy
}

// Process readings into time series data
export function processReadingsToTimeSeries(
  readings: SensorReading[] | any[],
  valueKey: string,
  keys: string[]
): Array<{ time: string; value: number }> {
  return readings.map(reading => {
    const value = extractReadingValue(reading, keys);
    const timestamp = extractTimestamp(reading);
    const date = new Date(timestamp);
    return {
      time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      value,
    };
  });
}

