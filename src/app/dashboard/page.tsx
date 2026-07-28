"use client";

import dynamic from "next/dynamic";
import { LoadingState } from "@/components/ui/loading-state";
import { MapPageChrome } from "@/components/MapPageChrome";
import { RequireAuth } from "@/components/RequireAuth";

const Map = dynamic(() => import("@/components/Map").then((mod) => ({ default: mod.Map })), {
  ssr: false,
  loading: () => (
    <LoadingState
      fill
      variant="overlay"
      message="Loading map"
      hint="Preparing your air quality dashboard"
    />
  ),
});

export default function Dashboard() {
  return (
    <RequireAuth
      message="Loading dashboard"
      hint="Verifying your session and preparing the map"
    >
      <div className="relative h-screen w-screen overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Map fullscreen />
        </div>

        <MapPageChrome />
      </div>
    </RequireAuth>
  );
}
