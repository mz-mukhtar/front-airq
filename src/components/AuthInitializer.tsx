"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only initialize once on mount to prevent multiple calls
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initialize();
    }
  }, [initialize]);

  return <>{children}</>;
}

