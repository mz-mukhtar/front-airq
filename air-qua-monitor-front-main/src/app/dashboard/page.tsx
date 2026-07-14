"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/store/authStore";
import { LoadingState } from "@/components/ui/loading-state";
import { MapPageChrome } from "@/components/MapPageChrome";

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
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <LoadingState
        fill
        variant="overlay"
        message="Loading dashboard"
        hint="Verifying your session and preparing the map"
        className="h-screen w-screen"
      />
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Map fullscreen />
      </div>

      <MapPageChrome />
    </div>
  );
}
