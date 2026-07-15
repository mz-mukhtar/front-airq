"use client";

import { Wind } from "lucide-react";
import { cn } from "@/lib/utils";

export type LoadingVariant = "page" | "overlay" | "inline" | "compact";

export interface LoadingStateProps {
  message?: string;
  hint?: string;
  variant?: LoadingVariant;
  className?: string;
  /** Stretch to fill the parent container */
  fill?: boolean;
}

export function LoadingState({
  message = "Loading…",
  hint,
  variant = "page",
  className,
  fill = false,
}: LoadingStateProps) {
  const isCompact = variant === "compact";
  const isInline = variant === "inline";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "loading-state",
        variant === "page" && "loading-state--page",
        variant === "overlay" && "loading-state--overlay",
        variant === "inline" && "loading-state--inline",
        variant === "compact" && "loading-state--compact",
        fill && "loading-state--fill",
        className
      )}
    >
      <div
        className={cn(
          "loading-state-card",
          isCompact && "loading-state-card--compact",
          isInline && "loading-state-card--inline"
        )}
      >
        <div
          className={cn(
            "loading-state-visual",
            isCompact && "loading-state-visual--compact",
            isInline && "loading-state-visual--inline"
          )}
          aria-hidden
        >
          <span className="loading-state-ring loading-state-ring--1" />
          <span className="loading-state-ring loading-state-ring--2" />
          <span className="loading-state-ring loading-state-ring--3" />
          <span className="loading-state-core">
            <Wind className="loading-state-icon" strokeWidth={2.25} />
          </span>
          <span className="loading-state-orbit">
            <span className="loading-state-particle loading-state-particle--1" />
            <span className="loading-state-particle loading-state-particle--2" />
            <span className="loading-state-particle loading-state-particle--3" />
          </span>
        </div>

        {!isCompact && (
          <div className="loading-state-copy">
            <p className="loading-state-message">{message}</p>
            {hint && <p className="loading-state-hint">{hint}</p>}
            <div className="loading-state-dots" aria-hidden>
              <span className="loading-state-dot" />
              <span className="loading-state-dot" />
              <span className="loading-state-dot" />
            </div>
          </div>
        )}
      </div>
      {isCompact && <span className="sr-only">{message}</span>}
    </div>
  );
}
