"use client";

import { useEffect, useState } from "react";
import { getLocations } from "@/lib/api/locations";
import { getSensorDevices } from "@/lib/api/sensor-devices";

export interface StationNavItem {
  id: string;
  name: string;
  deviceId: string;
}

/**
 * Fetches locations + devices and joins them into the station list used by
 * navigation chrome (Sidebar, MapPageChrome): one entry per location that has
 * at least one active device, pointing at that location's first active device.
 */
export function useStationNavItems() {
  const [stations, setStations] = useState<StationNavItem[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStations = async () => {
      try {
        const [locations, devices] = await Promise.all([
          getLocations(),
          getSensorDevices(),
        ]);
        if (cancelled) return;

        const stationItems: StationNavItem[] = [];
        for (const location of locations) {
          const locationDevices = devices.filter(
            (d) => d.location_id === location.id && d.status === "active"
          );
          if (locationDevices.length > 0) {
            stationItems.push({
              id: location.id,
              name: location.name,
              deviceId: locationDevices[0].id,
            });
          }
        }
        setStations(stationItems);
      } catch (error) {
        console.error("Error fetching stations:", error);
      } finally {
        if (!cancelled) setStationsLoading(false);
      }
    };

    fetchStations();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stations, stationsLoading };
}
