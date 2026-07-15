"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, RefreshCw, Filter } from "lucide-react";
import {
  getAnalyticsExceedances,
  AnalyticsMetric,
  AnalyticsExceedancesParams,
  AnalyticsExceedancesResponse,
} from "@/lib/api/analytics";
import { getSensorDevices } from "@/lib/api/sensor-devices";
import { getLocations } from "@/lib/api/locations";
import { SensorDevice, Location } from "@/lib/api/types";

const METRIC_OPTIONS: Array<{
  label: string;
  value: AnalyticsMetric;
  unit: string;
  defaultThreshold: number;
}> = [
  { label: "PM2.5", value: "pm2_5", unit: "µg/m³", defaultThreshold: 35 },
  { label: "PM10", value: "pm10", unit: "µg/m³", defaultThreshold: 50 },
  { label: "Temperature", value: "temperature", unit: "°C", defaultThreshold: 30 },
  { label: "Humidity", value: "humidity", unit: "%", defaultThreshold: 70 },
  { label: "VOC Index", value: "voc_index", unit: "index", defaultThreshold: 100 },
  { label: "NOx Index", value: "nox_index", unit: "index", defaultThreshold: 100 },
];

const PERIOD_OPTIONS = [
  { label: "24h", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "1y", value: 365 },
] as const;

interface FilterDraft {
  metric: AnalyticsMetric;
  thresholdInput: string;
  days: number;
  deviceFilter: string;
  locationFilter: string;
}

function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatWindowDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AlertsContent() {
  const [draft, setDraft] = useState<FilterDraft>({
    metric: "pm2_5",
    thresholdInput: "35",
    days: 30,
    deviceFilter: "all",
    locationFilter: "all",
  });

  const [appliedParams, setAppliedParams] = useState<AnalyticsExceedancesParams>({
    metric: "pm2_5",
    threshold: 35,
    days: 30,
    timezone: "Africa/Addis_Ababa",
    return_samples: true,
    max_samples: 100,
  });

  const [data, setData] = useState<AnalyticsExceedancesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const requestIdRef = useRef(0);
  const dataRef = useRef<AnalyticsExceedancesResponse | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Load devices and locations for dropdown filters and table lookups
  useEffect(() => {
    let active = true;
    Promise.all([
      getSensorDevices().catch(() => [] as SensorDevice[]),
      getLocations().catch(() => [] as Location[]),
    ]).then(([devs, locs]) => {
      if (!active || !isMounted.current) return;
      setDevices(devs);
      setLocations(locs);
    });
    return () => {
      active = false;
    };
  }, []);

  const devicesMap = useMemo(() => {
    return new Map(devices.map((d) => [d.id, d]));
  }, [devices]);

  const locationsMap = useMemo(() => {
    return new Map(locations.map((l) => [l.id, l]));
  }, [locations]);

  const currentMetricOption = useMemo(() => {
    return METRIC_OPTIONS.find((m) => m.value === draft.metric) ?? METRIC_OPTIONS[0];
  }, [draft.metric]);

  const activeMetricUnit = useMemo(() => {
    const opt = METRIC_OPTIONS.find((m) => m.value === (data?.metric ?? appliedParams.metric));
    return opt?.unit ?? "";
  }, [data?.metric, appliedParams.metric]);

  const loadExceedances = useCallback(
    async (params: AnalyticsExceedancesParams, isInitial: boolean) => {
      if (!isInitial && inFlight.current) return;
      const currentId = ++requestIdRef.current;
      inFlight.current = true;
      if (isInitial && !dataRef.current) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await getAnalyticsExceedances(params);
        if (!isMounted.current || requestIdRef.current !== currentId) return;
        dataRef.current = res;
        setData(res);
        setError(null);
      } catch (err: unknown) {
        if (!isMounted.current || requestIdRef.current !== currentId) return;
        setError(err instanceof Error ? err.message : "Failed to load threshold exceedances");
      } finally {
        if (isMounted.current && requestIdRef.current === currentId) {
          inFlight.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadExceedances(appliedParams, true);
  }, [appliedParams, loadExceedances]);

  const handleMetricChange = useCallback((newMetric: AnalyticsMetric) => {
    const opt = METRIC_OPTIONS.find((m) => m.value === newMetric);
    const defaultThresh = opt?.defaultThreshold ?? 35;
    setDraft((prev) => ({
      ...prev,
      metric: newMetric,
      thresholdInput: defaultThresh.toString(),
    }));
  }, []);

  const handleApplyFilters = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const parsed = parseFloat(draft.thresholdInput);
      const opt = METRIC_OPTIONS.find((m) => m.value === draft.metric);
      const defaultThresh = opt?.defaultThreshold ?? 35;

      let validThreshold = parsed;
      if (isNaN(parsed) || !Number.isFinite(parsed) || (draft.metric !== "temperature" && parsed < 0)) {
        validThreshold = defaultThresh;
      }

      setDraft((prev) => ({
        ...prev,
        thresholdInput: validThreshold.toString(),
      }));

      setAppliedParams({
        metric: draft.metric,
        threshold: validThreshold,
        days: draft.days,
        device_id: draft.deviceFilter !== "all" ? draft.deviceFilter : undefined,
        location_id: draft.locationFilter !== "all" ? draft.locationFilter : undefined,
        timezone: "Africa/Addis_Ababa",
        return_samples: true,
        max_samples: 100,
      });
    },
    [draft]
  );

  return (
    <div className="space-y-6">
      {/* Informational Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <div>
            <span className="font-semibold">Threshold Exceedance Report:</span> This page reports
            historical threshold exceedances. It does not represent acknowledged or resolved alerts.
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-base font-semibold">Filter Criteria</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExceedances(appliedParams, false)}
              disabled={refreshing || loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Configure metric, threshold limit, time window, and target devices to inspect historical exceedances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleApplyFilters} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Metric Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="exceedance-metric" className="text-xs font-semibold text-muted-foreground">
                  Metric
                </Label>
                <select
                  id="exceedance-metric"
                  value={draft.metric}
                  onChange={(e) => handleMetricChange(e.target.value as AnalyticsMetric)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {METRIC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold Limit */}
              <div className="space-y-1.5">
                <Label htmlFor="exceedance-threshold" className="text-xs font-semibold text-muted-foreground">
                  Threshold ({currentMetricOption.unit})
                </Label>
                <div className="relative">
                  <Input
                    id="exceedance-threshold"
                    type="number"
                    step="any"
                    min={draft.metric === "temperature" ? undefined : 0}
                    value={draft.thresholdInput}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, thresholdInput: e.target.value }))
                    }
                    className="pr-14"
                    placeholder={`e.g. ${currentMetricOption.defaultThreshold}`}
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-muted-foreground pointer-events-none">
                    {currentMetricOption.unit}
                  </span>
                </div>
              </div>

              {/* Time Window */}
              <div className="space-y-1.5">
                <Label htmlFor="exceedance-period" className="text-xs font-semibold text-muted-foreground">
                  Time Range
                </Label>
                <select
                  id="exceedance-period"
                  value={draft.days}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, days: parseInt(e.target.value, 10) }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Device Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="exceedance-device" className="text-xs font-semibold text-muted-foreground">
                  Device
                </Label>
                <select
                  id="exceedance-device"
                  value={draft.deviceFilter}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, deviceFilter: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All devices</option>
                  {devices.map((device) => {
                    const loc = locationsMap.get(device.location_id);
                    return (
                      <option key={device.id} value={device.id}>
                        {device.serial_number} {loc ? `(${loc.name})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Location Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="exceedance-location" className="text-xs font-semibold text-muted-foreground">
                  Location
                </Label>
                <select
                  id="exceedance-location"
                  value={draft.locationFilter}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, locationFilter: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button type="submit" size="sm" className="px-6 font-medium">
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading ? (
        <LoadingState
          variant="inline"
          message="Querying threshold exceedances..."
          hint="Evaluating historical sensor readings across the selected window"
          className="py-16"
        />
      ) : error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <AlertTriangle className="mb-3 h-8 w-8 text-destructive" aria-hidden />
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExceedances(appliedParams, false)}
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total Exceedances
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {data.exceedance_count.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Threshold Limit
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {data.threshold} <span className="text-sm font-normal text-muted-foreground">{activeMetricUnit}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Observed Metric
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {METRIC_OPTIONS.find((m) => m.value === data.metric)?.label ?? data.metric}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Evaluation Window
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatWindowDate(data.start_date)} – {formatWindowDate(data.end_date)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sample Count Honesty Banner */}
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              {data.exceedance_count > data.samples.length
                ? `Showing ${data.samples.length.toLocaleString()} sample readings from ${data.exceedance_count.toLocaleString()} total exceedances.`
                : `Showing ${data.samples.length.toLocaleString()} of ${data.exceedance_count.toLocaleString()} total exceedances.`}
            </span>
            <span className="font-mono">TZ: {data.timezone}</span>
          </div>

          {/* Data Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Recorded At</TableHead>
                  <TableHead className="w-[220px]">Device</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Observed Value</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead className="w-[180px] text-right">Reading ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.samples.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      No threshold exceedances found for the selected criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.samples.map((sample) => {
                    const dev = devicesMap.get(sample.device_id);
                    const loc = dev ? locationsMap.get(dev.location_id) : null;
                    return (
                      <TableRow key={sample.reading_id || `${sample.device_id}-${sample.recorded_at}`}>
                        <TableCell className="font-medium tabular-nums text-foreground">
                          {formatTimestamp(sample.recorded_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {dev?.serial_number || sample.device_id}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {sample.device_id}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {loc?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-foreground">
                          {sample.value !== null ? `${sample.value.toFixed(2)} ${activeMetricUnit}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {data.threshold} {activeMetricUnit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          <span title={sample.reading_id} className="inline-block max-w-[140px] truncate">
                            {sample.reading_id}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function AlertsPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <AppShell
      sectionLabel="Analytics"
      title="Air Quality Exceedances"
      subtitle="Review sensor readings that met or exceeded the selected threshold during the chosen time range."
      icon={AlertTriangle}
      mainClassName="bg-transparent"
    >
      <AlertsContent />
    </AppShell>
  );
}
