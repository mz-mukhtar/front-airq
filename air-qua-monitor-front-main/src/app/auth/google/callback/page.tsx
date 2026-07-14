"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { exchangeGoogleCode } from "@/lib/api/auth";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const { refreshUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        setError("Missing sign-in code. Please try signing in again.");
        return;
      }

      try {
        // Exchange the one-time code for a session (httpOnly cookie set by the proxy)
        await exchangeGoogleCode(code);
        await refreshUser();
        router.replace("/dashboard");
      } catch {
        setError("Google sign-in failed. The sign-in code may have expired.");
      }
    })();
  }, [router, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? (
        <div className="text-center space-y-3">
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/login" className="text-sm text-purple-700 hover:underline font-semibold">
            Back to login
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in with Google…</p>
      )}
    </div>
  );
}
