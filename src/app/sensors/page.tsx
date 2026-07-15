"use client";

import { useEffect, useState, useMemo, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, AlertCircle, Thermometer, Droplets, Download, LineChart as LineChartIcon, AreaChart as AreaChartIcon, BarChart as BarChartIcon, Table as TableIcon, X, Merge, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { getLocations } from "@/lib/api/locations";
import { getSensorDevices } from "@/lib/api/sensor-devices";
import { Location, SensorDevice, SensorReading } from "@/lib/api/types";
import { extractReadingValue, extractReadingValueOrNull, extractTimestamp, calculateAQI, getAQIStatus } from "@/lib/utils/readings";
import {
  fetchChartSeries,
  filtersToRawParams,
  formatSeriesMetaLabel,
  latestMetricsFromBuckets,
  groupSeriesByDevice,
  seriesReadingsByDevice,
} from "@/lib/utils/sensor-series";
import {
  getSensorReadingsPaginated,
  exportSensorReadingsCsv,
  exportSensorReadingsExcel,
  SensorReadingsExportParams,
} from "@/lib/api/sensor-readings";
import {
  ChartTimeRange,
  chartWindowTitle,
  seriesFiltersForRange,
} from "@/lib/utils/chart-time-range";
import { ChartTimeRangeSelector } from "@/components/sensors/ChartTimeRangeSelector";
import { ChartTimelineScrubber } from "@/components/sensors/ChartTimelineScrubber";
import {
  ZoomableTimeSeriesChart,
  ZoomDomain,
} from "@/components/sensors/ZoomableTimeSeriesChart";
import { SeriesMeta } from "@/lib/api/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Line,
  Area,
  Bar,
} from "recharts";

interface StationData {
  id: string;
  name: string;
  pm2_5: number;
  pm10_0: number;
  humidity: number;
  temperature: number;
  voc: number;
  nox: number;
  aqi: number;
  status: string;
  deviceId: string;
  locationId: string;
  readings: SensorReading[];
  // False when the selected time window has no readings for this device.
  hasData: boolean;
  // Most recent reading timestamp known for this device (ISO), even if outside
  // the selected window — used to show "last seen …" instead of a fake 0.
  lastSeenAt: string | null;
}

/** Human-friendly "time since" for a stale sensor's last reading. */
function formatLastSeen(iso: string | null): string {
  if (!iso) return "no data yet";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type ChartType = "line" | "area" | "bar";
type ViewMode = "graph" | "table";

// Above this many data points, per-point dots on line charts are pure SVG
// bloat — hide them and keep just the stroke.
const MAX_DOTS_DATA_LENGTH = 200;

/** Extra series props: disable per-point dots on large line series. */
function dotPropsFor(chartType: ChartType, dataLength: number): { dot?: false } {
  return chartType === "line" && dataLength > MAX_DOTS_DATA_LENGTH ? { dot: false } : {};
}

// Rows fetched per table page (server-side cursor pagination)
const TABLE_PAGE_SIZE = 100;

// Cached formatter — per-row Date#toLocaleString re-resolves the locale every call
const LOCAL_TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatAxisTime(ts: unknown) {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n)) return String(ts ?? "");
  return new Date(n).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatTooltipTime(ts: unknown) {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n)) return String(ts ?? "");
  return new Date(n).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function SensorsContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("device");
  const [stations, setStations] = useState<StationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pm25ChartType, setPm25ChartType] = useState<ChartType>("area");
  const [pm10ChartType, setPm10ChartType] = useState<ChartType>("area");
  const [temperatureChartType, setTemperatureChartType] = useState<ChartType>("area");
  const [humidityChartType, setHumidityChartType] = useState<ChartType>("area");
  const [tempHumidityMerged, setTempHumidityMerged] = useState(false);
  const [tempHumidityMergedChartType, setTempHumidityMergedChartType] = useState<ChartType>("area");
  const [pmMerged, setPmMerged] = useState(false);
  const [pmMergedChartType, setPmMergedChartType] = useState<ChartType>("area");
  // Separate color states for each graph type
  const [pm25Colors, setPm25Colors] = useState<Record<string, string>>({});
  const [pm10Colors, setPm10Colors] = useState<Record<string, string>>({});
  const [temperatureColors, setTemperatureColors] = useState<Record<string, string>>({});
  const [humidityColors, setHumidityColors] = useState<Record<string, string>>({});
  // CSV download dialog state
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [selectedStationsForExport, setSelectedStationsForExport] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<"csv" | "excel">("csv");
  const [includeDeviceInfo, setIncludeDeviceInfo] = useState(false);
  const [includeLocationInfo, setIncludeLocationInfo] = useState(false);
  // Initialize with empty array - will be set based on URL or default to first station
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  // Graph series from GET /sensor-readings/series (aggregated buckets).
  const [graphReadingsByDevice, setGraphReadingsByDevice] = useState<Record<string, SensorReading[]>>({});
  const [seriesMeta, setSeriesMeta] = useState<SeriesMeta | null>(null);
  // Raw readings for table view (cursor-paginated GET /sensor-readings/).
  // Only the current page is held in memory; next/previous fetch one page at a time.
  const [tableReadingsByDevice, setTableReadingsByDevice] = useState<Record<string, SensorReading[]>>({});
  const [tableLoading, setTableLoading] = useState(false);
  const [tableCursor, setTableCursor] = useState<string | null>(null);
  const [tablePrevCursors, setTablePrevCursors] = useState<string[]>([]);
  const [tableNextCursor, setTableNextCursor] = useState<string | null>(null);
  const [csvExportLoading, setCsvExportLoading] = useState(false);
  const [exportRange, setExportRange] = useState<"current" | "custom">("current");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  // Store all available devices with location info for the dropdown
  const [availableDevices, setAvailableDevices] = useState<Array<{
    device: SensorDevice;
    location: Location;
  }>>([]);
  const [chartTimeRange, setChartTimeRange] = useState<ChartTimeRange>("24h");
  const [seriesRefreshing, setSeriesRefreshing] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<ZoomDomain>(null);
  const skipRangeFetchRef = useRef(true);
  const chartTimeRangeRef = useRef(chartTimeRange);
  chartTimeRangeRef.current = chartTimeRange;
  // True once the first series response has populated stations — used to decide
  // blocking vs background loads without putting stations.length in effect deps.
  const stationsLoadedRef = useRef(false);
  // Monotonically increasing id so stale series responses can be discarded.
  const seriesRequestIdRef = useRef(0);
  // Last applied series query (devices + range) — zoom/table state is only reset
  // when this actually changes, not on background refreshes of the same query.
  const seriesQueryKeyRef = useRef<string | null>(null);
  // Last table query (devices + range) — pagination resets when it changes.
  const tableQueryKeyRef = useRef<string | null>(null);

  // Enhanced color palette – no red (reserved for warnings/bad trends only)
  const colorPalette = [
    "#10b981", // Green
    "#f59e0b", // Amber
    "#0d9488", // Teal
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
    "#f97316", // Orange
    "#6366f1", // Indigo
    "#14b8a6", // Teal (emerald)
    "#a855f7", // Violet
  ];

  const readingsForStation = (station: StationData): SensorReading[] => {
    if (viewMode === "table") {
      const table = tableReadingsByDevice[station.deviceId];
      if (table && table.length > 0) return table;
    }
    const graph = graphReadingsByDevice[station.deviceId];
    if (graph && graph.length > 0) return graph;
    return station.readings;
  };

  const activeDeviceIds = useMemo(
    () => selectedStationIds.filter((id) => availableDevices.some((item) => item.device.id === id)),
    [selectedStationIds, availableDevices]
  );

  const applySeriesResponse = useCallback(
    (
      seriesResponse: Awaited<ReturnType<typeof fetchChartSeries>>,
      devicesToFetch: string[],
      queryKey: string
    ) => {
      setSeriesMeta(seriesResponse.meta);

      // Only nuke zoom + table page when the query actually changed;
      // background refreshes of the same query keep the user's state.
      if (seriesQueryKeyRef.current !== queryKey) {
        seriesQueryKeyRef.current = queryKey;
        setZoomDomain(null);
        setTableReadingsByDevice({});
      }

      const groupedBuckets = groupSeriesByDevice(seriesResponse.series);
      const graphUpdates = seriesReadingsByDevice(groupedBuckets);
      setGraphReadingsByDevice((prev) => ({ ...prev, ...graphUpdates }));

      const stationsData: StationData[] = [];
      for (const deviceIdToFetch of devicesToFetch) {
        const deviceInfo = availableDevices.find((item) => item.device.id === deviceIdToFetch);
        if (!deviceInfo) continue;

        const buckets = groupedBuckets[deviceIdToFetch] ?? [];
        const latest = latestMetricsFromBuckets(buckets);
        const sortedReadings = graphUpdates[deviceIdToFetch] ?? [];

        if (sortedReadings.length > 0 || latest.recorded_at) {
          const aqi = calculateAQI(latest.pm2_5, latest.pm10);
          stationsData.push({
            id: deviceIdToFetch,
            name: deviceInfo.location.name,
            pm2_5: latest.pm2_5,
            pm10_0: latest.pm10,
            humidity: latest.humidity,
            temperature: latest.temperature,
            voc: latest.voc,
            nox: latest.nox,
            aqi,
            status: getAQIStatus(aqi),
            deviceId: deviceIdToFetch,
            locationId: deviceInfo.location.id,
            readings: sortedReadings,
            hasData: true,
            lastSeenAt: latest.recorded_at,
          });
        } else {
          stationsData.push({
            id: deviceIdToFetch,
            name: deviceInfo.location.name,
            pm2_5: 0,
            pm10_0: 0,
            humidity: 0,
            temperature: 0,
            voc: 0,
            nox: 0,
            aqi: 0,
            status: "No Data",
            deviceId: deviceIdToFetch,
            locationId: deviceInfo.location.id,
            readings: [],
            hasData: false,
            // last_seen_at comes from the series meta — the most recent reading
            // for the requested device(s), even though it's outside this window.
            lastSeenAt: seriesResponse.meta?.last_seen_at ?? null,
          });
        }
      }

      setStations((prev) => {
        const updated = [...prev];
        stationsData.forEach((newStation) => {
          const index = updated.findIndex((s) => s.id === newStation.id);
          if (index >= 0) updated[index] = newStation;
          else updated.push(newStation);
        });
        return updated;
      });
      if (stationsData.length > 0) stationsLoadedRef.current = true;
    },
    [availableDevices]
  );

  const loadSeries = useCallback(
    async (devicesToFetch: string[], range: ChartTimeRange, blocking: boolean) => {
      if (devicesToFetch.length === 0) return;

      // Race guard: capture a monotonically increasing id; if a newer request
      // starts while this one is in flight, the stale response is discarded.
      const requestId = ++seriesRequestIdRef.current;
      const queryKey = `${[...devicesToFetch].sort().join(",")}|${range}`;

      if (blocking) {
        setIsLoading(true);
        setError(null);
      } else {
        setSeriesRefreshing(true);
      }

      try {
        const seriesResponse = await fetchChartSeries(seriesFiltersForRange(range), devicesToFetch);
        if (requestId !== seriesRequestIdRef.current) return;
        applySeriesResponse(seriesResponse, devicesToFetch, queryKey);
      } catch (err: unknown) {
        if (requestId !== seriesRequestIdRef.current) return;
        console.error("Error fetching sensor readings:", err);
        if (blocking) {
          setError(err instanceof Error ? err.message : "Failed to load sensor readings");
        }
      } finally {
        // Only the latest request settles the loading flags; a stale request
        // must not clear a newer request's spinner.
        if (requestId === seriesRequestIdRef.current) {
          setIsLoading(false);
          setSeriesRefreshing(false);
        }
      }
    },
    [applySeriesResponse]
  );

  // Initial / station selection fetch (full-page loader only when no data yet)
  useEffect(() => {
    if (!isAuthenticated || availableDevices.length === 0 || activeDeviceIds.length === 0) {
      return;
    }
    const blocking = !stationsLoadedRef.current;
    loadSeries(activeDeviceIds, chartTimeRangeRef.current, blocking);
  }, [isAuthenticated, activeDeviceIds, availableDevices.length, loadSeries]);

  // Time range change — background refresh, no full-page reload
  useEffect(() => {
    if (skipRangeFetchRef.current) {
      skipRangeFetchRef.current = false;
      return;
    }
    if (!isAuthenticated || activeDeviceIds.length === 0 || !stationsLoadedRef.current) {
      return;
    }
    loadSeries(activeDeviceIds, chartTimeRange, false);
  }, [chartTimeRange, isAuthenticated, activeDeviceIds, loadSeries]);

  // Fetch device and location metadata only (no readings)
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!isAuthenticated) {
        router.push("/login");
        return;
      }

      try {
        const [locations, allDevices] = await Promise.all([
          getLocations(),
          getSensorDevices(),
        ]);
        const activeDevices = allDevices.filter(d => d.status === 'active');
        
        // Build available devices list
        const devicesList = activeDevices.map(device => {
          const location = locations.find(l => l.id === device.location_id);
          return { device, location: location! };
        }).filter(item => item.location);
        
        setAvailableDevices(devicesList);

        if (deviceId) {
          const deviceInfo = devicesList.find(item => item.device.id === deviceId);
          if (deviceInfo) {
            setSelectedStationIds([deviceId]);
          }
        } else if (devicesList.length > 0) {
          setSelectedStationIds((prev) => (prev.length > 0 ? prev : [devicesList[0].device.id]));
        }
      } catch (err: any) {
        console.error("Error fetching metadata:", err);
        setError(err?.message || "Failed to load device information");
      }
    };

    fetchMetadata();
  }, [isAuthenticated, router, deviceId]);

  // Fetch ONE page of raw readings for table view (cursor pagination).
  // Switching to table view no longer exhaustively pages the whole dataset.
  // Pagination reset is folded in here: when devices/range change, this run
  // resets the cursors itself instead of pairing new filters with a stale cursor.
  useEffect(() => {
    if (!isAuthenticated || viewMode !== "table" || activeDeviceIds.length === 0) {
      return;
    }

    const queryKey = `${activeDeviceIds.join(",")}|${chartTimeRange}`;
    if (tableQueryKeyRef.current !== queryKey) {
      tableQueryKeyRef.current = queryKey;
      setTablePrevCursors([]);
      setTableNextCursor(null);
      if (tableCursor !== null) {
        // Re-run with a clean cursor instead of fetching with the stale one.
        setTableCursor(null);
        return;
      }
    }

    let cancelled = false;

    const loadTablePage = async () => {
      setTableLoading(true);
      try {
        const params = filtersToRawParams(
          seriesFiltersForRange(chartTimeRange),
          activeDeviceIds
        );
        const page = await getSensorReadingsPaginated({
          ...params,
          order: "desc",
          limit: TABLE_PAGE_SIZE,
          cursor: tableCursor ?? undefined,
        });
        if (cancelled) return;

        const byDevice: Record<string, SensorReading[]> = {};
        for (const reading of page.data) {
          const did = reading.device_id;
          if (!byDevice[did]) byDevice[did] = [];
          byDevice[did].push(reading);
        }
        setTableReadingsByDevice(byDevice);
        setTableNextCursor(page.pagination.has_more ? page.pagination.next_cursor : null);
      } catch (err) {
        console.error("Error fetching table readings:", err);
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    };

    loadTablePage();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, viewMode, activeDeviceIds, chartTimeRange, tableCursor]);

  // Use selectedStationIds for filtering - show all selected stations for comparison
  // Ensure at least one station is displayed
  // IMPORTANT: This must be computed before any conditional returns to maintain hook order
  const displayStations = useMemo(
    () =>
      selectedStationIds.length > 0
        ? stations.filter((s) => selectedStationIds.includes(s.id))
        : stations.length > 0
          ? [stations[0]]
          : [], // Fallback to first station if none selected
    [selectedStationIds, stations]
  );

  // Charts always render graph (series bucket) data — table readings are for the
  // table only. Depends only on graphReadingsByDevice, so memo deps stay honest.
  const graphReadingsFor = useCallback(
    (station: StationData): SensorReading[] => {
      const graph = graphReadingsByDevice[station.deviceId];
      if (graph && graph.length > 0) return graph;
      return station.readings;
    },
    [graphReadingsByDevice]
  );

  // Initialize selected stations when dialog opens
  useEffect(() => {
    if (csvDialogOpen && displayStations.length > 0) {
      setSelectedStationsForExport(new Set(displayStations.map(s => s.id)));
    }
  }, [csvDialogOpen, displayStations.length]);

  // Generate merged PM data - combine PM2.5 and PM10 for all stations, grouped by time.
  // Graph data comes from GET /sensor-readings/series (aggregated buckets).
  const pmData = useMemo(() => {
    if (displayStations.length === 0) return [];

    const allReadings: Array<{ timestamp: number; reading: SensorReading; stationName: string }> = [];
    displayStations.forEach((station) => {
      graphReadingsFor(station).forEach((reading) => {
        const timestamp = extractTimestamp(reading);
        allReadings.push({ timestamp, reading, stationName: station.name });
      });
    });

    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp - b.timestamp);

    // Group readings by time (same second) so all stations appear in the same data point
    const groupedByTime = new Map<number, Map<string, { pm25: number; pm10: number }>>();

    allReadings.forEach(({ timestamp, reading, stationName }) => {
      const ts = Math.floor(timestamp / 1000) * 1000;

      if (!groupedByTime.has(ts)) {
        groupedByTime.set(ts, new Map());
      }

      const pm25 = extractReadingValue(reading, ["pm2_5", "PM2.5", "PM2_5"]);
      const pm10 = extractReadingValue(reading, ["pm10", "PM10", "pm10_0", "PM10_0"]);
      groupedByTime.get(ts)!.set(stationName, { pm25, pm10 });
    });

    // Convert to array format
    return Array.from(groupedByTime.entries()).map(([ts, stationValues]) => {
      const dataPoint: Record<string, number | string> = { ts, time: formatAxisTime(ts) };
      stationValues.forEach((values, stationName) => {
        dataPoint[`${stationName} - PM2.5`] = values.pm25;
        dataPoint[`${stationName} - PM10`] = values.pm10;
      });
      return dataPoint;
    });
  }, [displayStations, graphReadingsFor]);

  // Generate separate PM2.5 data - grouped by time to show all stations together
  const pm25Data = useMemo(() => {
    if (displayStations.length === 0) return [];
    
    // Collect all readings with their timestamps
    const allReadings: Array<{ timestamp: number; reading: SensorReading; stationName: string }> = [];
    displayStations.forEach(station => {
      graphReadingsFor(station).forEach(reading => {
        const timestamp = extractTimestamp(reading);
        allReadings.push({ timestamp, reading, stationName: station.name });
      });
    });
    
    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group readings by time (same second) so all stations appear in the same data point
    const groupedByTime = new Map<number, Map<string, number>>();
    
    allReadings.forEach(({ timestamp, reading, stationName }) => {
      const ts = Math.floor(timestamp / 1000) * 1000;
      
      if (!groupedByTime.has(ts)) {
        groupedByTime.set(ts, new Map());
      }
      
      const value = extractReadingValue(reading, ['pm2_5', 'PM2.5', 'PM2_5']);
      groupedByTime.get(ts)!.set(stationName, value);
    });
    
    // Convert to array format
    return Array.from(groupedByTime.entries()).map(([ts, stationValues]) => {
      const dataPoint: Record<string, number | string> = { ts, time: formatAxisTime(ts) };
      stationValues.forEach((value, stationName) => {
        dataPoint[stationName] = value;
      });
      return dataPoint;
    });
  }, [displayStations, graphReadingsFor]);

  // Generate separate PM10 data - grouped by time to show all stations together
  const pm10Data = useMemo(() => {
    if (displayStations.length === 0) return [];
    
    // Collect all readings with their timestamps
    const allReadings: Array<{ timestamp: number; reading: SensorReading; stationName: string }> = [];
    displayStations.forEach(station => {
      graphReadingsFor(station).forEach(reading => {
        const timestamp = extractTimestamp(reading);
        allReadings.push({ timestamp, reading, stationName: station.name });
      });
    });
    
    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group readings by time (same second) so all stations appear in the same data point
    const groupedByTime = new Map<number, Map<string, number>>();
    
    allReadings.forEach(({ timestamp, reading, stationName }) => {
      const ts = Math.floor(timestamp / 1000) * 1000;
      
      if (!groupedByTime.has(ts)) {
        groupedByTime.set(ts, new Map());
      }
      
      const value = extractReadingValue(reading, ['pm10', 'PM10', 'pm10_0', 'PM10_0']);
      groupedByTime.get(ts)!.set(stationName, value);
    });
    
    // Convert to array format
    return Array.from(groupedByTime.entries()).map(([ts, stationValues]) => {
      const dataPoint: Record<string, number | string> = { ts, time: formatAxisTime(ts) };
      stationValues.forEach((value, stationName) => {
        dataPoint[stationName] = value;
      });
      return dataPoint;
    });
  }, [displayStations, graphReadingsFor]);

  // Generate temperature time series data - grouped by time to show all stations together
  const temperatureData = useMemo(() => {
    if (displayStations.length === 0) return [];
    
    // Collect all readings with their timestamps
    const allReadings: Array<{ timestamp: number; reading: SensorReading; stationName: string }> = [];
    displayStations.forEach(station => {
      graphReadingsFor(station).forEach(reading => {
        const timestamp = extractTimestamp(reading);
        allReadings.push({ timestamp, reading, stationName: station.name });
      });
    });
    
    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group readings by time (same second) so all stations appear in the same data point
    const groupedByTime = new Map<number, Map<string, number>>();
    
    allReadings.forEach(({ timestamp, reading, stationName }) => {
      const ts = Math.floor(timestamp / 1000) * 1000;
      
      if (!groupedByTime.has(ts)) {
        groupedByTime.set(ts, new Map());
      }
      
      const value = extractReadingValue(reading, ['temperature', 'Temperature', 'temp']);
      groupedByTime.get(ts)!.set(stationName, value);
    });
    
    // Convert to array format
    return Array.from(groupedByTime.entries()).map(([ts, stationValues]) => {
      const dataPoint: Record<string, number | string> = { ts, time: formatAxisTime(ts) };
      stationValues.forEach((value, stationName) => {
        dataPoint[stationName] = value;
      });
      return dataPoint;
    });
  }, [displayStations, graphReadingsFor]);

  // Generate humidity time series data - grouped by time to show all stations together
  const humidityData = useMemo(() => {
    if (displayStations.length === 0) return [];
    
    // Collect all readings with their timestamps
    const allReadings: Array<{ timestamp: number; reading: SensorReading; stationName: string }> = [];
    displayStations.forEach(station => {
      graphReadingsFor(station).forEach(reading => {
        const timestamp = extractTimestamp(reading);
        allReadings.push({ timestamp, reading, stationName: station.name });
      });
    });
    
    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group readings by time (same second) so all stations appear in the same data point
    const groupedByTime = new Map<number, Map<string, number>>();
    
    allReadings.forEach(({ timestamp, reading, stationName }) => {
      const ts = Math.floor(timestamp / 1000) * 1000;
      
      if (!groupedByTime.has(ts)) {
        groupedByTime.set(ts, new Map());
      }
      
      const value = extractReadingValue(reading, ['humidity', 'Humidity']);
      groupedByTime.get(ts)!.set(stationName, value);
    });
    
    // Convert to array format
    return Array.from(groupedByTime.entries()).map(([ts, stationValues]) => {
      const dataPoint: Record<string, number | string> = { ts, time: formatAxisTime(ts) };
      stationValues.forEach((value, stationName) => {
        dataPoint[stationName] = value;
      });
      return dataPoint;
    });
  }, [displayStations, graphReadingsFor]);

  // Generate merged temperature and humidity data - grouped by time to show all stations together
  const tempHumidityMergedData = useMemo(() => {
    if (displayStations.length === 0 || !tempHumidityMerged) return [];
    
    // Collect all readings with their timestamps
    const allReadings: Array<{ timestamp: number; reading: SensorReading; stationName: string }> = [];
    displayStations.forEach(station => {
      graphReadingsFor(station).forEach(reading => {
        const timestamp = extractTimestamp(reading);
        allReadings.push({ timestamp, reading, stationName: station.name });
      });
    });
    
    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group readings by time (same second) so all stations appear in the same data point
    const groupedByTime = new Map<number, Map<string, { temperature: number; humidity: number }>>();
    
    allReadings.forEach(({ timestamp, reading, stationName }) => {
      const ts = Math.floor(timestamp / 1000) * 1000;
      
      if (!groupedByTime.has(ts)) {
        groupedByTime.set(ts, new Map());
      }
      
      const temperature = extractReadingValue(reading, ['temperature', 'Temperature', 'temp']);
      const humidity = extractReadingValue(reading, ['humidity', 'Humidity']);
      groupedByTime.get(ts)!.set(stationName, { temperature, humidity });
    });
    
    // Convert to array format
    return Array.from(groupedByTime.entries()).map(([ts, stationValues]) => {
      const dataPoint: Record<string, number | string> = { ts, time: formatAxisTime(ts) };
      stationValues.forEach((values, stationName) => {
        dataPoint[`${stationName} - Temperature (°C)`] = values.temperature;
        dataPoint[`${stationName} - Humidity (%)`] = values.humidity;
      });
      return dataPoint;
    });
  }, [displayStations, tempHumidityMerged, graphReadingsFor]);

  const timelineExtent = useMemo((): [number, number] | null => {
    if (seriesMeta?.window?.start && seriesMeta?.window?.end) {
      const start = new Date(seriesMeta.window.start).getTime();
      const end = new Date(seriesMeta.window.end).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return [start, end];
      }
    }

    const timestamps = pm25Data
      .map((row) => Number(row.ts))
      .filter((ts) => Number.isFinite(ts));
    if (timestamps.length === 0) return null;
    return [Math.min(...timestamps), Math.max(...timestamps)];
  }, [pm25Data, seriesMeta]);

  // Prepare table data from all readings (sorted newest first)
  const tableData = useMemo(() => {
    const rows: Array<{
      timestamp: number;
      timestampISO: string;
      timestampLocal: string;
      station: StationData;
      reading: SensorReading;
      pm1: number | null;
      pm25: number | null;
      pm4: number | null;
      pm10: number | null;
      nc0_5: number | null;
      nc1_0: number | null;
      nc2_5: number | null;
      nc4_0: number | null;
      nc10_0: number | null;
      typicalParticleSize: number | null;
      temperature: number | null;
      humidity: number | null;
      voc: number | null;
      nox: number | null;
      aqi: number | null;
    }> = [];

    // Table rows are only rendered in table view — skip the work in graph view.
    if (viewMode !== "table") return rows;

    displayStations.forEach((station) => {
      const stationReadings =
        tableReadingsByDevice[station.deviceId]?.length
          ? tableReadingsByDevice[station.deviceId]
          : graphReadingsByDevice[station.deviceId]?.length
            ? graphReadingsByDevice[station.deviceId]
            : station.readings;

      stationReadings.forEach((reading) => {
        const timestamp = extractTimestamp(reading);
        const date = new Date(timestamp);
        const pm1 = extractReadingValueOrNull(reading, ['pm1_0', 'PM1.0', 'PM1_0']);
        const pm25 = extractReadingValueOrNull(reading, ['pm2_5', 'PM2.5', 'PM2_5']);
        const pm4 = extractReadingValueOrNull(reading, ['pm4_0', 'PM4.0', 'PM4_0']);
        const pm10 = extractReadingValueOrNull(reading, ['pm10', 'PM10', 'pm10_0', 'PM10_0']);
        const nc0_5 = extractReadingValueOrNull(reading, ['nc0_5', 'NC0.5', 'NC0_5']);
        const nc1_0 = extractReadingValueOrNull(reading, ['nc1_0', 'NC1.0', 'NC1_0']);
        const nc2_5 = extractReadingValueOrNull(reading, ['nc2_5', 'NC2.5', 'NC2_5']);
        const nc4_0 = extractReadingValueOrNull(reading, ['nc4_0', 'NC4.0', 'NC4_0']);
        const nc10_0 = extractReadingValueOrNull(reading, ['nc10_0', 'NC10.0', 'NC10_0']);
        const typicalParticleSize = extractReadingValueOrNull(reading, ['typical_particle_size', 'typical_particle_size_um', 'tps']);
        const temperature = extractReadingValueOrNull(reading, ['temperature', 'Temperature', 'temp']);
        const humidity = extractReadingValueOrNull(reading, ['humidity', 'Humidity']);
        const voc = extractReadingValueOrNull(reading, ['voc_index', 'VOC', 'voc']);
        const nox = extractReadingValueOrNull(reading, ['nox_index', 'NOx', 'nox', 'NO2']);
        const aqi =
          pm25 !== null || pm10 !== null ? calculateAQI(pm25 ?? NaN, pm10 ?? NaN) : null;

        rows.push({
          timestamp,
          timestampISO: date.toISOString(),
          timestampLocal: LOCAL_TIMESTAMP_FORMAT.format(date),
          station,
          reading,
          pm1,
          pm25,
          pm4,
          pm10,
          nc0_5,
          nc1_0,
          nc2_5,
          nc4_0,
          nc10_0,
          typicalParticleSize,
          temperature,
          humidity,
          voc,
          nox,
          aqi,
        });
      });
    });

    // Sort by timestamp (newest first). A single device's table page is already
    // server-sorted desc, so skip the client re-sort in that case.
    const serverSorted =
      displayStations.length === 1 &&
      (tableReadingsByDevice[displayStations[0].deviceId]?.length ?? 0) > 0;
    if (!serverSorted) {
      rows.sort((a, b) => b.timestamp - a.timestamp);
    }
    return rows;
  }, [displayStations, graphReadingsByDevice, tableReadingsByDevice, viewMode]);

  // Server-side cursor pagination handlers for table view
  const goToNextTablePage = () => {
    if (!tableNextCursor) return;
    setTablePrevCursors((prev) => [...prev, tableCursor ?? ""]);
    setTableCursor(tableNextCursor);
  };

  const goToPreviousTablePage = () => {
    if (tablePrevCursors.length === 0) return;
    const last = tablePrevCursors[tablePrevCursors.length - 1];
    setTablePrevCursors(tablePrevCursors.slice(0, -1));
    setTableCursor(last === "" ? null : last);
  };

  const tablePageNumber = tablePrevCursors.length + 1;

  // Now we can do conditional returns AFTER all hooks
  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <LoadingState
        fill
        variant="overlay"
        message="Loading sensor data"
        hint="Fetching chart series from aggregated buckets"
        className="min-h-screen"
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading sensor data</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (displayStations.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No sensor data available</p>
        </div>
      </div>
    );
  }

  const toggleStation = async (deviceId: string) => {
    // Check if this device's data is already loaded
    const existingStation = stations.find(s => s.id === deviceId);
    
    if (existingStation) {
      // Device data is already loaded, just toggle selection
      setSelectedStationIds(prev => {
        if (prev.includes(deviceId)) {
          // Don't allow deselecting if it's the last one
          if (prev.length > 1) {
            return prev.filter(id => id !== deviceId);
          }
          return prev;
        } else {
          // Enforce max of 2 selected stations for comparison
          if (prev.length >= 2) {
            // Replace the oldest selection with the new one
            return [prev[1], deviceId];
          }
          return [...prev, deviceId];
        }
      });
    } else {
      // Device data is not loaded yet - just add to selection
      // The useEffect will automatically fetch data for selected devices
      setSelectedStationIds(prev => {
        if (prev.includes(deviceId)) return prev;
        if (prev.length >= 2) {
          return [prev[1], deviceId];
        }
        return [...prev, deviceId];
      });
    }
  };

  const selectAllStations = () => {
    // Only allow comparison of up to two stations
    const ids = stations.map(s => s.id);
    if (ids.length === 0) return;
    if (ids.length === 1) {
      setSelectedStationIds([ids[0]]);
    } else {
      setSelectedStationIds([ids[0], ids[1]]);
    }
  };

  const deselectAllStations = () => {
    // Don't allow deselecting all stations - keep at least one
    if (selectedStationIds.length > 1) {
      setSelectedStationIds([selectedStationIds[0]]);
    }
  };

  // datetime-local inputs want "YYYY-MM-DDTHH:mm" in local time
  const toLocalInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Pre-fill a sensible window (last 7 days) the first time custom is picked
  const selectCustomExportRange = () => {
    if (!exportStartDate || !exportEndDate) {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (!exportStartDate) setExportStartDate(toLocalInputValue(start));
      if (!exportEndDate) setExportEndDate(toLocalInputValue(end));
    }
    setExportRange("custom");
  };

  const customExportRangeInvalid =
    exportRange === "custom" &&
    (!exportStartDate ||
      !exportEndDate ||
      new Date(exportStartDate) >= new Date(exportEndDate));

  // Handle file download with selected stations and format using backend export endpoints.
  const handleExportDownload = async () => {
    const selectedStations = displayStations.filter(s => selectedStationsForExport.has(s.id));

    if (selectedStations.length === 0) {
      alert("Please select at least one station to export.");
      return;
    }

    let exportFilters: SensorReadingsExportParams = seriesFiltersForRange(chartTimeRange);
    if (exportRange === "custom") {
      if (!exportStartDate || !exportEndDate) {
        alert("Please pick both a start and an end date.");
        return;
      }
      const start = new Date(exportStartDate);
      const end = new Date(exportEndDate);
      if (start >= end) {
        alert("The start date must be before the end date.");
        return;
      }
      exportFilters = {
        timezone: "Africa/Addis_Ababa",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      };
    }

    const exportParams: SensorReadingsExportParams = {
      ...exportFilters,
      device_ids: selectedStations.map(s => s.deviceId),
      include_device_info: includeDeviceInfo,
      include_location_info: includeLocationInfo,
    };

    setCsvExportLoading(true);
    try {
      const downloadedFile = exportFormat === "csv"
        ? await exportSensorReadingsCsv(exportParams)
        : await exportSensorReadingsExcel(exportParams);

      const url = URL.createObjectURL(downloadedFile.blob);
      const link = document.createElement("a");
      link.href = url;
      if (downloadedFile.filename) {
        link.download = downloadedFile.filename;
      } else {
        const ext = exportFormat === "csv" ? "csv" : "xlsx";
        link.download = `sensor-readings-${new Date().toISOString().split("T")[0]}.${ext}`;
      }
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setCsvDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      alert(message);
    } finally {
      setCsvExportLoading(false);
    }
  };

  // Open CSV download dialog
  const openCSVDialog = () => {
    // Initialize with all stations selected
    setSelectedStationsForExport(new Set(displayStations.map(s => s.id)));
    setCsvDialogOpen(true);
  };

  // Chart type icons
  const getChartIcon = (type: ChartType) => {
    switch (type) {
      case "line":
        return <LineChartIcon className="h-4 w-4" />;
      case "area":
        return <AreaChartIcon className="h-4 w-4" />;
      case "bar":
        return <BarChartIcon className="h-4 w-4" />;
    }
  };

  // Get color for a specific graph type and station
  const getGraphColor = (graphType: 'pm25' | 'pm10' | 'temperature' | 'humidity', stationName: string, stationIndex: number): string => {
    const colorMap: Record<string, Record<string, string>> = {
      pm25: pm25Colors,
      pm10: pm10Colors,
      temperature: temperatureColors,
      humidity: humidityColors,
    };

    // If custom color exists, use it
    if (colorMap[graphType] && colorMap[graphType][stationName]) {
      return colorMap[graphType][stationName];
    }

    // Otherwise, use default color from palette based on station index
    // Each graph type starts with different colors
    const graphColorOffsets: Record<string, number> = {
      pm25: 0,      // Start from first color
      pm10: 2,      // Start from third color
      temperature: 4, // Start from fifth color
      humidity: 6,   // Start from seventh color
    };
    
    const colorIndex = (stationIndex + (graphColorOffsets[graphType] || 0)) % colorPalette.length;
    return colorPalette[colorIndex];
  };

  // Custom tooltip formatter to round values
  const formatTooltipValue = (value: any) => {
    if (typeof value === 'number') {
      return Math.round(value * 100) / 100; // Round to 2 decimal places
    }
    return value;
  };

  // Custom tooltip component that shows all stations at the hovered time
  const CustomTooltip = ({ active, payload, label, data }: any) => {
    if (active && payload && payload.length) {
      // Get the time from the label or payload
      const timeValue = label ?? payload[0]?.payload?.ts ?? payload[0]?.payload?.time;
      
      // Collect all entries from payload (these are the data series that have values at this point)
      const allEntries = new Map<string, { name: string; value: any; color: string }>();
      
      // Add all entries from the payload (Recharts with shared=true will include all series)
      payload.forEach((entry: any) => {
        if (entry.dataKey && entry.value !== undefined && entry.value !== null) {
          allEntries.set(entry.dataKey, {
            name: entry.name || entry.dataKey,
            value: entry.value,
            color: entry.color,
          });
        }
      });
      
      // If we have the full data array and want to show all stations even if they don't have data at this exact time,
      // find all data points at this time and aggregate
      if (data && Array.isArray(data) && displayStations.length > 1) {
        // Find all data points at this exact time
        const dataPointsAtTime = data.filter((d: any) => (d.ts ?? d.time) === timeValue);
        
        // For each station, find its value at this time
        displayStations.forEach((station) => {
          // Check if this station's data is already in the payload
          const stationKey = station.name;
          const hasInPayload = payload.some((p: any) => p.dataKey === stationKey);
          
          if (!hasInPayload) {
            // Look for this station's value in data points at this time
            for (const dataPoint of dataPointsAtTime) {
              if (dataPoint[stationKey] !== undefined && dataPoint[stationKey] !== null) {
                // Find the color for this station by looking at the chart's color function
                // We'll use a default color or try to find it from existing entries
                const color = getGraphColor('pm25', station.name, displayStations.indexOf(station));
                allEntries.set(stationKey, {
                  name: stationKey,
                  value: dataPoint[stationKey],
                  color: color,
                });
                break;
              }
            }
          }
        });
      }
      
      // Get time label
      const dataPoint = payload[0]?.payload;
      let timeLabel: string;
      
      timeLabel = formatTooltipTime(timeValue);
      
      // Sort entries by station name for consistent display
      const sortedEntries = Array.from(allEntries.values()).sort((a, b) => a.name.localeCompare(b.name));
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
          <p className="font-semibold mb-2">Time: {timeLabel}</p>
          {sortedEntries.length > 0 ? (
            sortedEntries.map((entry, index) => (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {`${entry.name}: ${formatTooltipValue(entry.value)}`}
              </p>
            ))
          ) : (
            payload.map((entry: any, index: number) => (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {`${entry.name}: ${formatTooltipValue(entry.value)}`}
              </p>
            ))
          )}
        </div>
      );
    }
    return null;
  };

  const renderCombinedPMChart = (
    data: Record<string, number | string>[],
    yAxisLabel: string,
    getPm25Color: (station: StationData, index: number) => string,
    getPm10Color: (station: StationData, index: number) => string,
    chartType: ChartType
  ) => {
    const DataComponent = chartType === "line" ? Line : chartType === "area" ? Area : Bar;
    const pm25Opacity = chartType === "area" ? (displayStations.length > 1 ? 0.3 : 0.4) : undefined;
    const pm10Opacity = chartType === "area" ? (displayStations.length > 1 ? 0.15 : 0.2) : undefined;
    const strokeWidth = displayStations.length > 1 ? 2.5 : 2;
    const dotProps = dotPropsFor(chartType, data.length);

    return (
      <ZoomableTimeSeriesChart
        data={data}
        yAxisLabel={yAxisLabel}
        chartType={chartType}
        timeRange={chartTimeRange}
        zoomDomain={zoomDomain}
        onZoomDomainChange={setZoomDomain}
        tooltipContent={CustomTooltip}
        stationCount={displayStations.length}
      >
        {displayStations.flatMap((station, index) => {
          const pm25Color = getPm25Color(station, index);
          const pm10Color = getPm10Color(station, index);
          const pm10DashArray = chartType === "line" ? "5 5" : undefined;

          return [
            <DataComponent
              key={`${station.id}-pm25`}
              type="monotone"
              dataKey={`${station.name} - PM2.5`}
              stroke={pm25Color}
              fill={pm25Color}
              fillOpacity={pm25Opacity}
              strokeWidth={strokeWidth}
              connectNulls
              {...dotProps}
            />,
            <DataComponent
              key={`${station.id}-pm10`}
              type="monotone"
              dataKey={`${station.name} - PM10`}
              stroke={pm10Color}
              fill={pm10Color}
              fillOpacity={pm10Opacity}
              strokeWidth={strokeWidth}
              strokeDasharray={pm10DashArray}
              connectNulls
              {...dotProps}
            />,
          ];
        })}
      </ZoomableTimeSeriesChart>
    );
  };

  const renderTimeSeriesChart = (
    data: Record<string, number | string>[],
    yAxisLabel: string,
    getColor: (station: StationData, index: number) => string,
    chartType: ChartType
  ) => {
    const DataComponent = chartType === "line" ? Line : chartType === "area" ? Area : Bar;
    const baseOpacity = chartType === "area" ? (displayStations.length > 1 ? 0.2 : 0.3) : undefined;
    const strokeWidth = displayStations.length > 1 ? 2.5 : 2;
    const dotProps = dotPropsFor(chartType, data.length);

    return (
      <ZoomableTimeSeriesChart
        data={data}
        yAxisLabel={yAxisLabel}
        chartType={chartType}
        timeRange={chartTimeRange}
        zoomDomain={zoomDomain}
        onZoomDomainChange={setZoomDomain}
        tooltipContent={CustomTooltip}
        stationCount={displayStations.length}
      >
        {displayStations.map((station, index) => {
          const color = getColor(station, index);
          const strokeDasharray =
            chartType === "line" && displayStations.length > 1 && index > 0
              ? index % 2 === 0
                ? "5 5"
                : "10 5"
              : undefined;

          return (
            <DataComponent
              key={station.id}
              type="monotone"
              dataKey={station.name}
              stroke={color}
              fill={color}
              fillOpacity={baseOpacity}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              connectNulls
              {...dotProps}
            />
          );
        })}
      </ZoomableTimeSeriesChart>
    );
  };

  const renderTempHumidityMergedChart = () => {
    const chartType = tempHumidityMergedChartType;
    const DataComponent = chartType === "line" ? Line : chartType === "area" ? Area : Bar;
    const tempOpacity = chartType === "area" ? (displayStations.length > 1 ? 0.3 : 0.4) : undefined;
    const humidityOpacity = chartType === "area" ? (displayStations.length > 1 ? 0.15 : 0.2) : undefined;
    const strokeWidth = displayStations.length > 1 ? 2.5 : 2;
    const dotProps = dotPropsFor(chartType, tempHumidityMergedData.length);

    return (
      <ZoomableTimeSeriesChart
        data={tempHumidityMergedData}
        yAxisLabel="°C / %"
        chartType={chartType}
        timeRange={chartTimeRange}
        zoomDomain={zoomDomain}
        onZoomDomainChange={setZoomDomain}
        tooltipContent={CustomTooltip}
        stationCount={displayStations.length}
      >
        {displayStations.flatMap((station, index) => {
          const tempColor = getGraphColor("temperature", station.name, index);
          const humidityColor = getGraphColor("humidity", station.name, index);
          const humidityDashArray = chartType === "line" ? "5 5" : undefined;

          return [
            <DataComponent
              key={`${station.id}-temp`}
              type="monotone"
              dataKey={`${station.name} - Temperature (°C)`}
              stroke={tempColor}
              fill={tempColor}
              fillOpacity={tempOpacity}
              strokeWidth={strokeWidth}
              connectNulls
              {...dotProps}
            />,
            <DataComponent
              key={`${station.id}-humidity`}
              type="monotone"
              dataKey={`${station.name} - Humidity (%)`}
              stroke={humidityColor}
              fill={humidityColor}
              fillOpacity={humidityOpacity}
              strokeWidth={strokeWidth}
              strokeDasharray={humidityDashArray}
              connectNulls
              {...dotProps}
            />,
          ];
        })}
      </ZoomableTimeSeriesChart>
    );
  };

  const chartRangeTitle = chartWindowTitle(chartTimeRange);

  const sensorPageTitle =
    displayStations.length === 1
      ? displayStations[0].name
      : displayStations.length > 1
        ? `Comparing ${displayStations.length} stations`
        : "Sensor research data";

  const sensorPageSubtitle =
    displayStations.length > 1
      ? [displayStations.map((s) => s.name).join(" · "), formatSeriesMetaLabel(seriesMeta)]
          .filter(Boolean)
          .join(" · ")
      : seriesMeta?.last_seen_at && graphReadingsByDevice[displayStations[0]?.deviceId]?.length === 0
        ? `No recent data · last seen ${new Date(seriesMeta.last_seen_at).toLocaleString()}`
        : formatSeriesMetaLabel(seriesMeta) ?? "Charts, tables, and CSV export";

  return (
    <>
    <AppShell
      sectionLabel="Sensors"
      title={sensorPageTitle}
      subtitle={sensorPageSubtitle}
      icon={Database}
      mainClassName="bg-transparent"
    >
          {authLoading ? (
            <LoadingState
              fill
              variant="page"
              message="Loading sensor data"
              hint="Preparing charts and station data"
              className="h-[calc(100vh-3.75rem)]"
            />
          ) : (
            <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Database className="h-4 w-4" />
                  Stations ({displayStations.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
                <DropdownMenuLabel>Select Stations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={selectAllStations}>
                  Select All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={deselectAllStations}>
                  Deselect All
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableDevices.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No devices available
                  </DropdownMenuItem>
                ) : (
                  availableDevices.map(({ device, location }) => {
                    const hasData = stations.some(s => s.id === device.id);
                    const isSelected = selectedStationIds.includes(device.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={device.id}
                        checked={isSelected}
                        onCheckedChange={() => toggleStation(device.id)}
                        className={!hasData ? "opacity-60" : ""}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{location.name}</span>
                          {!hasData && (
                            <span className="text-xs text-muted-foreground ml-2">(No data)</span>
                          )}
                        </div>
                      </DropdownMenuCheckboxItem>
                    );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === "graph" ? "table" : "graph")}
              className="gap-2"
            >
              {viewMode === "graph" ? (
                <>
                  <TableIcon className="h-4 w-4" />
                  Table View
                </>
              ) : (
                <>
                  <LineChartIcon className="h-4 w-4" />
                  Graph View
                </>
              )}
            </Button>
            <Button
              onClick={openCSVDialog}
              className="bg-[#016FC4] hover:bg-[#015a9e] text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>

        {viewMode === "graph" && (
          <ChartTimeRangeSelector
            value={chartTimeRange}
            onChange={setChartTimeRange}
            onResetZoom={() => setZoomDomain(null)}
            zoomActive={zoomDomain !== null}
            refreshing={seriesRefreshing}
          />
        )}

        {viewMode === "graph" && timelineExtent && (
          <ChartTimelineScrubber
            minTs={timelineExtent[0]}
            maxTs={timelineExtent[1]}
            domain={zoomDomain}
            onChange={setZoomDomain}
            timeRange={chartTimeRange}
            disabled={seriesRefreshing}
          />
        )}

        {viewMode === "graph" && seriesMeta && (
          <p className="text-sm text-muted-foreground">
            {formatSeriesMetaLabel(seriesMeta)}.
            {" "}
            Use the timeline scrubber to scroll and zoom · scroll wheel on charts to zoom in/out.
          </p>
        )}

        {/* Table View */}
        {viewMode === "table" ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                Sensor Data Table
              </CardTitle>
              <CardDescription>
                All sensor readings from selected stations in tabular format
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tableLoading ? (
                <LoadingState
                  variant="inline"
                  message="Loading table data"
                  hint="Fetching raw readings via cursor pagination"
                />
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left p-3 font-semibold text-sm">Timestamp</th>
                      <th className="text-left p-3 font-semibold text-sm">Station</th>
                      <th className="text-right p-3 font-semibold text-sm">PM1.0 (µg/m³)</th>
                      <th className="text-right p-3 font-semibold text-sm">PM2.5 (µg/m³)</th>
                      <th className="text-right p-3 font-semibold text-sm">PM4.0 (µg/m³)</th>
                      <th className="text-right p-3 font-semibold text-sm">PM10 (µg/m³)</th>
                      <th className="text-right p-3 font-semibold text-sm">NC0.5 (#/cm³)</th>
                      <th className="text-right p-3 font-semibold text-sm">NC1.0 (#/cm³)</th>
                      <th className="text-right p-3 font-semibold text-sm">NC2.5 (#/cm³)</th>
                      <th className="text-right p-3 font-semibold text-sm">NC4.0 (#/cm³)</th>
                      <th className="text-right p-3 font-semibold text-sm">NC10.0 (#/cm³)</th>
                      <th className="text-right p-3 font-semibold text-sm">Typical Particle Size (µm)</th>
                      <th className="text-right p-3 font-semibold text-sm">Temperature (°C)</th>
                      <th className="text-right p-3 font-semibold text-sm">Humidity (%)</th>
                      <th className="text-right p-3 font-semibold text-sm">VOC Index</th>
                      <th className="text-right p-3 font-semibold text-sm">NOx Index</th>
                      <th className="text-right p-3 font-semibold text-sm">AQI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="text-center p-8 text-muted-foreground">
                          No sensor data available
                        </td>
                      </tr>
                    ) : (
                      tableData.map((row, index) => (
                        <tr
                          key={`${row.station.id}-${row.timestamp}-${index}`}
                          className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <td className="p-3 text-sm">{row.timestampLocal}</td>
                          <td className="p-3 text-sm font-medium">{row.station.name}</td>
                          <td className="p-3 text-sm text-right">{row.pm1?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.pm25?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.pm4?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.pm10?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.nc0_5?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.nc1_0?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.nc2_5?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.nc4_0?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.nc10_0?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.typicalParticleSize?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.temperature?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.humidity?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.voc?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right">{row.nox?.toFixed(2) ?? "—"}</td>
                          <td className="p-3 text-sm text-right font-semibold">{row.aqi ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              )}
              {!tableLoading && tableData.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
                  <div>
                    Showing {tableData.length} reading{tableData.length !== 1 ? "s" : ""} from{" "}
                    {displayStations.length} station{displayStations.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tablePrevCursors.length === 0}
                      onClick={goToPreviousTablePage}
                    >
                      Previous
                    </Button>
                    <span>Page {tablePageNumber}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!tableNextCursor}
                      onClick={goToNextTablePage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={seriesRefreshing ? "space-y-6 opacity-70 transition-opacity duration-200" : "space-y-6 transition-opacity duration-200"}>
            {/* PM Charts - Merged or Separate */}
            {pmMerged ? (
              /* Combined PM2.5 & PM10 Time Series Chart */
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Merge className="h-5 w-5 text-purple-600" />
                        PM2.5 & PM10 Concentration ({chartRangeTitle})
                      </CardTitle>
                      <CardDescription>
                        Fine (PM2.5) and coarse (PM10) particulate matter levels over the last 24 hours. 
                        WHO guidelines: PM2.5 ≤12 µg/m³, PM10 ≤20 µg/m³
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border-r pr-2 mr-2">
                        <span className="text-xs text-muted-foreground mr-1">PM2.5:</span>
                        {displayStations.map((station, index) => (
                          <input
                            key={`pm25-${station.id}`}
                            type="color"
                            value={getGraphColor('pm25', station.name, index)}
                            onChange={(e) => {
                              setPm25Colors({
                                ...pm25Colors,
                                [station.name]: e.target.value,
                              });
                            }}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                            title={`Change PM2.5 color for ${station.name}`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">PM10:</span>
                        {displayStations.map((station, index) => (
                          <input
                            key={`pm10-${station.id}`}
                            type="color"
                            value={getGraphColor('pm10', station.name, index)}
                            onChange={(e) => {
                              setPm10Colors({
                                ...pm10Colors,
                                [station.name]: e.target.value,
                              });
                            }}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                            title={`Change PM10 color for ${station.name}`}
                          />
                        ))}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            {getChartIcon(pmMergedChartType)}
                            {pmMergedChartType.charAt(0).toUpperCase() + pmMergedChartType.slice(1)}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setPmMergedChartType("line")}>
                            <LineChartIcon className="h-4 w-4 mr-2" />
                            Line Chart
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPmMergedChartType("area")}>
                            <AreaChartIcon className="h-4 w-4 mr-2" />
                            Area Chart
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPmMergedChartType("bar")}>
                            <BarChartIcon className="h-4 w-4 mr-2" />
                            Bar Chart
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPmMerged(false)}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Unmerge
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {renderCombinedPMChart(
                    pmData,
                    "µg/m³",
                    (station, index) => getGraphColor('pm25', station.name, index),
                    (station, index) => getGraphColor('pm10', station.name, index),
                    pmMergedChartType
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* PM2.5 Time Series Chart */}
                <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                      PM2.5 Concentration ({chartRangeTitle})
                    </CardTitle>
                    <CardDescription>
                      Fine particulate matter levels over the last 24 hours. WHO guideline: ≤12 µg/m³
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {displayStations.map((station, index) => (
                      <input
                        key={station.id}
                        type="color"
                        value={getGraphColor('pm25', station.name, index)}
                        onChange={(e) => {
                          setPm25Colors({
                            ...pm25Colors,
                            [station.name]: e.target.value,
                          });
                        }}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                        title={`Change PM2.5 color for ${station.name}`}
                      />
                    ))}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          {getChartIcon(pm25ChartType)}
                          {pm25ChartType.charAt(0).toUpperCase() + pm25ChartType.slice(1)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setPm25ChartType("line")}>
                          <LineChartIcon className="h-4 w-4 mr-2" />
                          Line Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPm25ChartType("area")}>
                          <AreaChartIcon className="h-4 w-4 mr-2" />
                          Area Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPm25ChartType("bar")}>
                          <BarChartIcon className="h-4 w-4 mr-2" />
                          Bar Chart
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPmMerged(true)}
                      className="gap-2"
                    >
                      <Merge className="h-4 w-4" />
                      Merge with PM10
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderTimeSeriesChart(
                  pm25Data,
                  "µg/m³",
                  (station, index) => getGraphColor('pm25', station.name, index),
                  pm25ChartType
                )}
              </CardContent>
            </Card>

            {/* PM10 Time Series Chart */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                      PM10.0 Concentration ({chartRangeTitle})
                    </CardTitle>
                    <CardDescription>
                      Coarse particulate matter levels over the last 24 hours. WHO guideline: ≤20 µg/m³
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {displayStations.map((station, index) => (
                      <input
                        key={station.id}
                        type="color"
                        value={getGraphColor('pm10', station.name, index)}
                        onChange={(e) => {
                          setPm10Colors({
                            ...pm10Colors,
                            [station.name]: e.target.value,
                          });
                        }}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                        title={`Change PM10 color for ${station.name}`}
                      />
                    ))}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          {getChartIcon(pm10ChartType)}
                          {pm10ChartType.charAt(0).toUpperCase() + pm10ChartType.slice(1)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setPm10ChartType("line")}>
                          <LineChartIcon className="h-4 w-4 mr-2" />
                          Line Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPm10ChartType("area")}>
                          <AreaChartIcon className="h-4 w-4 mr-2" />
                          Area Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPm10ChartType("bar")}>
                          <BarChartIcon className="h-4 w-4 mr-2" />
                          Bar Chart
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPmMerged(true)}
                      className="gap-2"
                    >
                      <Merge className="h-4 w-4" />
                      Merge with PM2.5
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderTimeSeriesChart(
                  pm10Data,
                  "µg/m³",
                  (station, index) => getGraphColor('pm10', station.name, index),
                  pm10ChartType
                )}
              </CardContent>
            </Card>
              </>
            )}

        {/* VOC and NOx charts are intentionally not displayed (data is still collected and CSV-exported). */}

        {/* Temperature and Humidity Charts */}
        {tempHumidityMerged ? (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Merge className="h-5 w-5 text-purple-600" />
                    Temperature & Humidity ({chartRangeTitle})
                  </CardTitle>
                  <CardDescription>
                    Combined temperature and humidity levels over the last 24 hours
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        {getChartIcon(tempHumidityMergedChartType)}
                        {tempHumidityMergedChartType.charAt(0).toUpperCase() + tempHumidityMergedChartType.slice(1)}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setTempHumidityMergedChartType("line")}>
                        <LineChartIcon className="h-4 w-4 mr-2" />
                        Line Chart
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTempHumidityMergedChartType("area")}>
                        <AreaChartIcon className="h-4 w-4 mr-2" />
                        Area Chart
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTempHumidityMergedChartType("bar")}>
                        <BarChartIcon className="h-4 w-4 mr-2" />
                        Bar Chart
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTempHumidityMerged(false)}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Unmerge
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderTempHumidityMergedChart()}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Temperature Time Series Chart */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5 text-amber-500" />
                      Temperature ({chartRangeTitle})
                    </CardTitle>
                    <CardDescription>
                      Ambient air temperature levels over the last 24 hours
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {displayStations.map((station, index) => (
                      <input
                        key={station.id}
                        type="color"
                        value={getGraphColor('temperature', station.name, index)}
                        onChange={(e) => {
                          setTemperatureColors({
                            ...temperatureColors,
                            [station.name]: e.target.value,
                          });
                        }}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                        title={`Change Temperature color for ${station.name}`}
                      />
                    ))}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          {getChartIcon(temperatureChartType)}
                          {temperatureChartType.charAt(0).toUpperCase() + temperatureChartType.slice(1)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setTemperatureChartType("line")}>
                          <LineChartIcon className="h-4 w-4 mr-2" />
                          Line Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTemperatureChartType("area")}>
                          <AreaChartIcon className="h-4 w-4 mr-2" />
                          Area Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTemperatureChartType("bar")}>
                          <BarChartIcon className="h-4 w-4 mr-2" />
                          Bar Chart
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTempHumidityMerged(true)}
                      className="gap-2"
                    >
                      <Merge className="h-4 w-4" />
                      Merge
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderTimeSeriesChart(
                  temperatureData,
                  "°C",
                  (station, index) => getGraphColor('temperature', station.name, index),
                  temperatureChartType
                )}
              </CardContent>
            </Card>

            {/* Humidity Time Series Chart */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-blue-500" />
                      Humidity ({chartRangeTitle})
                    </CardTitle>
                    <CardDescription>
                      Relative humidity levels over the last 24 hours
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {displayStations.map((station, index) => (
                      <input
                        key={station.id}
                        type="color"
                        value={getGraphColor('humidity', station.name, index)}
                        onChange={(e) => {
                          setHumidityColors({
                            ...humidityColors,
                            [station.name]: e.target.value,
                          });
                        }}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                        title={`Change Humidity color for ${station.name}`}
                      />
                    ))}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          {getChartIcon(humidityChartType)}
                          {humidityChartType.charAt(0).toUpperCase() + humidityChartType.slice(1)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setHumidityChartType("line")}>
                          <LineChartIcon className="h-4 w-4 mr-2" />
                          Line Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHumidityChartType("area")}>
                          <AreaChartIcon className="h-4 w-4 mr-2" />
                          Area Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHumidityChartType("bar")}>
                          <BarChartIcon className="h-4 w-4 mr-2" />
                          Bar Chart
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTempHumidityMerged(true)}
                      className="gap-2"
                    >
                      <Merge className="h-4 w-4" />
                      Merge
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderTimeSeriesChart(
                  humidityData,
                  "%",
                  (station, index) => getGraphColor('humidity', station.name, index),
                  humidityChartType
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Station Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayStations.map((station) => (
            <Card key={station.id} className={`border-2 ${!station.hasData ? "opacity-80" : ""}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{station.name}</CardTitle>
                  {!station.hasData && (
                    <span
                      className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                      title={station.lastSeenAt ? `Last reading: ${new Date(station.lastSeenAt).toLocaleString()}` : "No readings yet"}
                    >
                      Stale · last seen {formatLastSeen(station.lastSeenAt)}
                    </span>
                  )}
                </div>
                <CardDescription>
                  {station.hasData ? "Current Readings" : "No data in selected range"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">AQI:</span>
                  <span className="font-bold">{station.hasData ? station.aqi : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">PM2.5:</span>
                  <span className="font-semibold">{station.hasData ? `${station.pm2_5} µg/m³` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">PM10:</span>
                  <span className="font-semibold">{station.hasData ? `${station.pm10_0} µg/m³` : "—"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
          </div>
        )}
          </div>
          )}
    </AppShell>

      {/* CSV Download Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Sensor Data</DialogTitle>
            <DialogDescription>
              Select the stations, date range, and format for the export.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Station Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Select Stations</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                {displayStations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stations available</p>
                ) : (
                  displayStations.map((station) => (
                    <div key={station.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`station-${station.id}`}
                        checked={selectedStationsForExport.has(station.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedStationsForExport);
                          if (e.target.checked) {
                            newSet.add(station.id);
                          } else {
                            newSet.delete(station.id);
                          }
                          setSelectedStationsForExport(newSet);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                      />
                      <label
                        htmlFor={`station-${station.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {station.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {displayStations.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedStationsForExport(new Set(displayStations.map(s => s.id)));
                    }}
                    className="text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedStationsForExport(new Set());
                    }}
                    className="text-xs"
                  >
                    Deselect All
                  </Button>
                </div>
              )}
            </div>

            {/* Date Range Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Date Range</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="range-current"
                    name="export-range"
                    value="current"
                    checked={exportRange === "current"}
                    onChange={() => setExportRange("current")}
                    className="h-4 w-4 border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                  />
                  <label
                    htmlFor="range-current"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Current chart range (last {chartWindowTitle(chartTimeRange).toLowerCase()})
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="range-custom"
                    name="export-range"
                    value="custom"
                    checked={exportRange === "custom"}
                    onChange={selectCustomExportRange}
                    className="h-4 w-4 border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                  />
                  <label
                    htmlFor="range-custom"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Custom range
                  </label>
                </div>
                {exportRange === "custom" && (
                  <div className="pl-6 pt-1 space-y-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label htmlFor="export-start" className="text-xs text-muted-foreground">
                          From
                        </label>
                        <input
                          type="datetime-local"
                          id="export-start"
                          value={exportStartDate}
                          max={exportEndDate || undefined}
                          onChange={(e) => setExportStartDate(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#016FC4]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="export-end" className="text-xs text-muted-foreground">
                          To
                        </label>
                        <input
                          type="datetime-local"
                          id="export-end"
                          value={exportEndDate}
                          min={exportStartDate || undefined}
                          onChange={(e) => setExportEndDate(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#016FC4]"
                        />
                      </div>
                    </div>
                    {customExportRangeInvalid && exportStartDate && exportEndDate && (
                      <p className="text-xs text-destructive">
                        The start date must be before the end date.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Export Format Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Export Format</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="format-csv"
                    name="export-format"
                    value="csv"
                    checked={exportFormat === "csv"}
                    onChange={() => setExportFormat("csv")}
                    className="h-4 w-4 border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                  />
                  <label
                    htmlFor="format-csv"
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Comma Separated Values)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="format-excel"
                    name="export-format"
                    value="excel"
                    checked={exportFormat === "excel"}
                    onChange={() => setExportFormat("excel")}
                    className="h-4 w-4 border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                  />
                  <label
                    htmlFor="format-excel"
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Spreadsheet (.xlsx)
                  </label>
                </div>
              </div>
            </div>

            {/* Additional Information Options */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Include Metadata Columns</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="include-device-info"
                    checked={includeDeviceInfo}
                    onChange={(e) => setIncludeDeviceInfo(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                  />
                  <label
                    htmlFor="include-device-info"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Include Device Info (serial number, status, etc.)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="include-location-info"
                    checked={includeLocationInfo}
                    onChange={(e) => setIncludeLocationInfo(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#016FC4] focus:ring-[#016FC4]"
                  />
                  <label
                    htmlFor="include-location-info"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Include Location Info (coordinates, address, etc.)
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCsvDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportDownload}
              className="bg-[#016FC4] hover:bg-[#015a9e] text-white"
              disabled={selectedStationsForExport.size === 0 || csvExportLoading || customExportRangeInvalid}
            >
              <Download className="h-4 w-4 mr-2" />
              {csvExportLoading
                ? "Exporting…"
                : `Export ${exportFormat === "csv" ? "CSV" : "Excel"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SensorsPage() {
  return (
    <Suspense fallback={
      <LoadingState
        fill
        variant="overlay"
        message="Loading sensor data"
        hint="Initializing the sensors dashboard"
        className="min-h-screen"
      />
    }>
      <SensorsContent />
    </Suspense>
  );
}

