"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { formatAxisTimeForRange, ChartTimeRange } from "@/lib/utils/chart-time-range";
import type { ZoomDomain } from "@/components/sensors/ZoomableTimeSeriesChart";

interface ChartTimelineScrubberProps {
  minTs: number;
  maxTs: number;
  domain: ZoomDomain;
  onChange: (domain: ZoomDomain) => void;
  timeRange: ChartTimeRange;
  disabled?: boolean;
}

type DragMode = "pan" | "left" | "right" | null;

const MIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes minimum visible window

function clampDomain(
  start: number,
  end: number,
  minTs: number,
  maxTs: number
): [number, number] {
  const span = maxTs - minTs;
  let windowMs = Math.max(end - start, Math.min(MIN_WINDOW_MS, span));
  windowMs = Math.min(windowMs, span);

  let nextStart = start;
  let nextEnd = end;

  if (nextEnd - nextStart < windowMs) {
    nextEnd = nextStart + windowMs;
  }

  if (nextStart < minTs) {
    nextStart = minTs;
    nextEnd = minTs + windowMs;
  }
  if (nextEnd > maxTs) {
    nextEnd = maxTs;
    nextStart = maxTs - windowMs;
  }

  return [nextStart, nextEnd];
}

function pct(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

export function ChartTimelineScrubber({
  minTs,
  maxTs,
  domain,
  onChange,
  timeRange,
  disabled,
}: ChartTimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    pointerId: number;
    originX: number;
    originStart: number;
    originEnd: number;
  } | null>(null);

  const span = maxTs - minTs;
  const [start, end] = domain ?? [minTs, maxTs];
  const leftPct = pct(start, minTs, maxTs);
  const widthPct = pct(end, minTs, maxTs) - leftPct;

  const tsFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || span <= 0) return minTs;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return minTs + ratio * span;
    },
    [minTs, span]
  );

  const beginDrag = (
    mode: DragMode,
    e: React.PointerEvent,
    currentStart = start,
    currentEnd = end
  ) => {
    if (disabled || span <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      pointerId: e.pointerId,
      originX: e.clientX,
      originStart: currentStart,
      originEnd: currentEnd,
    };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId || span <= 0) return;

      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const deltaRatio = (e.clientX - drag.originX) / rect.width;
      const deltaMs = deltaRatio * span;

      if (drag.mode === "pan") {
        const windowMs = drag.originEnd - drag.originStart;
        let nextStart = drag.originStart + deltaMs;
        let nextEnd = drag.originEnd + deltaMs;
        if (nextStart < minTs) {
          nextStart = minTs;
          nextEnd = minTs + windowMs;
        }
        if (nextEnd > maxTs) {
          nextEnd = maxTs;
          nextStart = maxTs - windowMs;
        }
        onChange([nextStart, nextEnd]);
        return;
      }

      if (drag.mode === "left") {
        onChange(clampDomain(drag.originStart + deltaMs, drag.originEnd, minTs, maxTs));
        return;
      }

      if (drag.mode === "right") {
        onChange(clampDomain(drag.originStart, drag.originEnd + deltaMs, minTs, maxTs));
      }
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [minTs, maxTs, onChange, span]);

  const handleTrackClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || span <= 0 || dragRef.current) return;
    if ((e.target as HTMLElement).dataset.handle) return;

    const clickTs = tsFromClientX(e.clientX);
    const windowMs = end - start;
    const half = windowMs / 2;
    onChange(clampDomain(clickTs - half, clickTs + half, minTs, maxTs));
  };

  const zoomBy = (factor: number) => {
    if (disabled || span <= 0) return;
    const center = (start + end) / 2;
    const windowMs = end - start;
    const nextWindow = Math.min(span, Math.max(windowMs * factor, MIN_WINDOW_MS));
    onChange(clampDomain(center - nextWindow / 2, center + nextWindow / 2, minTs, maxTs));
  };

  if (span <= 0) return null;

  const isFullView = !domain || (start <= minTs + 1 && end >= maxTs - 1);

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatAxisTimeForRange(start, timeRange)} — {formatAxisTimeForRange(end, timeRange)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={disabled || isFullView}
            title="Zoom out"
            onClick={() => zoomBy(1.35)}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={disabled}
            title="Zoom in"
            onClick={() => zoomBy(0.65)}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label="Chart timeline"
        aria-valuemin={minTs}
        aria-valuemax={maxTs}
        className={`relative h-10 rounded-md bg-muted/60 touch-none select-none ${
          disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"
        }`}
        onPointerDown={handleTrackClick}
      >
        {/* Full-range faint ticks */}
        <div className="absolute inset-x-2 inset-y-2 rounded bg-background/40" />

        {/* Selected window */}
        <div
          className="absolute top-1 bottom-1 rounded-md border-2 border-[#016FC4] bg-[#016FC4]/15 cursor-grab active:cursor-grabbing"
          style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
          data-handle="window"
          onPointerDown={(e) => beginDrag("pan", e)}
        >
          {/* Left resize handle */}
          <div
            data-handle="left"
            className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize rounded-l-md bg-[#016FC4]/80 hover:bg-[#016FC4]"
            onPointerDown={(e) => beginDrag("left", e)}
          />
          {/* Right resize handle */}
          <div
            data-handle="right"
            className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-ew-resize rounded-r-md bg-[#016FC4]/80 hover:bg-[#016FC4]"
            onPointerDown={(e) => beginDrag("right", e)}
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Drag the blue window to scroll · drag edges to zoom · click track to jump · scroll on chart to zoom
      </p>
    </div>
  );
}
