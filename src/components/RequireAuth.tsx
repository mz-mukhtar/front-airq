"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { LoadingState } from "@/components/ui/loading-state";

/**
 * Client-side half of route protection, for pages already listed in the
 * middleware's PROTECTED_PREFIXES.
 *
 * The two layers do different jobs and both are needed: the middleware can only
 * see whether a session *cookie exists*, so it can't catch an expired or
 * revoked session — this guard runs after /auth/me has actually answered. What
 * it must never be is the *only* protection, which is how /alerts ended up
 * rendering its shell to anonymous visitors before bouncing them.
 *
 * Reads the store's `isAuthenticated` rather than deriving `!!user`, so it
 * agrees with every other auth consumer.
 */
export function RequireAuth({
  children,
  message = "Loading",
  hint = "Verifying your session",
  fallback,
}: {
  children: React.ReactNode;
  message?: string;
  hint?: string;
  /**
   * What to show while the session is being verified. Pages built around
   * AppShell pass their shell here so the nav stays put and only the content
   * area swaps — a full-screen loader followed by chrome appearing reads as a
   * layout jump. Omit it for full-bleed pages like /dashboard.
   */
  fallback?: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;

    // Read the location directly rather than via useSearchParams: this guard
    // wraps statically-rendered pages, and the hook would force every one of
    // them to need its own Suspense boundary.
    const next =
      typeof window === "undefined"
        ? ""
        : `${window.location.pathname}${window.location.search}`;

    router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      fallback ?? (
        <LoadingState
          fill
          variant="overlay"
          message={message}
          hint={hint}
          className="h-screen w-screen"
        />
      )
    );
  }

  if (!isAuthenticated) return null;

  // Children mount only once the session is confirmed. That is what lets the
  // guarded pages drop their own isAuthenticated checks: inside here it is
  // always true, so effects can fetch immediately instead of running once to
  // bail out and again once auth resolves.
  return <>{children}</>;
}
