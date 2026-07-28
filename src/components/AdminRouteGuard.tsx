"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { LoadingState } from "@/components/ui/loading-state";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  // Reads the store's flag rather than deriving `!!user` — deriving it here was
  // a third, independently-drifting answer to "is this visitor signed in?".
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Carry the admin page being requested so login can return them to it.
      const next =
        typeof window === "undefined"
          ? ""
          : `${window.location.pathname}${window.location.search}`;
      router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
      return;
    }

    if (user?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <LoadingState
        fill
        variant="overlay"
        message="Loading admin panel"
        hint="Verifying administrator access"
        className="h-screen w-screen"
      />
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return <>{children}</>;
}

