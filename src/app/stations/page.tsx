"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";
import {
  StationDetailPanel,
  StationExplorerCard,
  type StationExplorerEntry,
} from "@/components/stations/StationExplorer";
import { useAuthStore } from "@/store/authStore";
import { getSensorDevices } from "@/lib/api/sensor-devices";
import {
  fetchPublicDashboardData,
  normalizeAirQualityLevel,
} from "@/lib/utils/readings";
import { Radio, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = ["All", "Good", "Moderate", "Unhealthy"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function StationsPage() {
  return (
    <Suspense
      fallback={
        <LoadingState
          fill
          variant="page"
          message="Loading stations"
          className="min-h-screen"
        />
      }
    >
      <StationsPageContent />
    </Suspense>
  );
}

function StationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceParam = searchParams.get("device");
  const { isAuthenticated } = useAuthStore();
  const [stations, setStations] = useState<StationExplorerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [{ locations, joined, stations: mapStations }, devices] = await Promise.all([
          fetchPublicDashboardData(),
          getSensorDevices(),
        ]);

        if (cancelled) return;

        const locationMap = new Map(locations.map((l) => [l.id, l]));
        const deviceMap = new Map(devices.map((d) => [d.id, d]));
        const kpiMap = new Map(joined.map((j) => [j.device_id, j]));

        const merged: StationExplorerEntry[] = mapStations.map((station) => {
          const loc = locationMap.get(station.locationId);
          const device = deviceMap.get(station.deviceId);
          const kpi = kpiMap.get(station.deviceId);

          return {
            ...station,
            description: loc?.description,
            serialNumber: device?.serial_number ?? kpi?.serial_number,
            recordedAt: kpi?.recorded_at,
            deviceStatus: device?.status,
          };
        });

        setStations(merged);
        if (deviceParam) {
          const match = merged.find((s) => s.deviceId === deviceParam);
          if (match) setSelectedId(match.id);
          else if (merged.length > 0) setSelectedId(merged[0].id);
        } else if (merged.length > 0) {
          setSelectedId(merged[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [deviceParam]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stations.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false) ||
        (s.serialNumber?.toLowerCase().includes(q) ?? false);

      const level = normalizeAirQualityLevel(s.airQualityLevel);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Good" && level === "Good") ||
        (statusFilter === "Moderate" && level === "Moderate") ||
        (statusFilter === "Unhealthy" &&
          level !== "Good" &&
          level !== "Moderate" &&
          level !== "Unknown");

      return matchesSearch && matchesStatus;
    });
  }, [stations, search, statusFilter]);

  const selectedStation = useMemo(
    () => filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const selectedIndex = useMemo(() => {
    if (!selectedStation) return -1;
    return filtered.findIndex((s) => s.id === selectedStation.id);
  }, [filtered, selectedStation]);

  const goToStationAt = useCallback(
    (index: number) => {
      const station = filtered[index];
      if (station) setSelectedId(station.id);
    },
    [filtered]
  );

  const goToPrevious = useCallback(() => {
    if (selectedIndex > 0) goToStationAt(selectedIndex - 1);
  }, [selectedIndex, goToStationAt]);

  const goToNext = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < filtered.length - 1) {
      goToStationAt(selectedIndex + 1);
    }
  }, [selectedIndex, filtered.length, goToStationAt]);

  useEffect(() => {
    if (selectedId && !filtered.some((s) => s.id === selectedId) && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPrevious, goToNext]);

  useEffect(() => {
    if (!selectedId) return;
    document
      .getElementById(`station-card-${selectedId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const handleViewAnalytics = (deviceId: string) => {
    if (isAuthenticated) {
      router.push(`/sensors?device=${deviceId}`);
    } else {
      router.push("/login");
    }
  };

  return (
    <AppShell
      sectionLabel="Stations"
      title="All monitoring stations"
      subtitle={`${stations.length} active sensors across Addis Ababa · latest readings`}
      icon={Radio}
      mainClassName="bg-transparent"
    >
      {loading ? (
        <LoadingState
          fill
          variant="page"
          message="Loading stations"
          hint="Fetching locations, devices, and latest air quality readings"
          className="min-h-[calc(100vh-3.75rem)]"
        />
      ) : error ? (
        <div className="mx-auto max-w-lg p-8 text-center">
          <p className="font-semibold text-destructive">Unable to load stations</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, location, or serial…"
                className="pl-9"
                aria-label="Search stations"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    statusFilter === filter
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {stations.length} stations
          </p>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {filtered.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-border py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No stations match your filters</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try clearing search or choosing All.</p>
                </div>
              ) : (
                filtered.map((station) => (
                  <StationExplorerCard
                    key={station.id}
                    station={station}
                    selected={selectedStation?.id === station.id}
                    onSelect={(s) => setSelectedId(s.id)}
                    onViewAnalytics={handleViewAnalytics}
                  />
                ))
              )}
            </div>

            <aside className="lg:sticky lg:top-[calc(3.75rem+1.5rem)] lg:self-start">
              <StationDetailPanel
                station={selectedStation}
                currentIndex={selectedIndex >= 0 ? selectedIndex : 0}
                totalCount={filtered.length}
                onPrevious={goToPrevious}
                onNext={goToNext}
                onViewAnalytics={handleViewAnalytics}
                onViewMap={() => router.push("/dashboard")}
              />
            </aside>
          </div>
        </div>
      )}
    </AppShell>
  );
}
