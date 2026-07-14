"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTimeRange, formatAxisTimeForRange } from "@/lib/utils/chart-time-range";

type ChartType = "line" | "area" | "bar";
type ZoomDomain = [number, number] | null;

export interface ZoomableTimeSeriesChartProps {
  data: Record<string, number | string>[];
  yAxisLabel: string;
  chartType: ChartType;
  timeRange: ChartTimeRange;
  children: ReactNode;
  height?: number;
  zoomDomain?: ZoomDomain;
  onZoomDomainChange?: (domain: ZoomDomain) => void;
  tooltipContent?: React.ComponentType<{ data?: Record<string, number | string>[] }>;
  stationCount?: number;
}

const MIN_WINDOW_MS = 5 * 60 * 1000;

function getDataExtent(data: Record<string, number | string>[]): [number, number] | null {
  if (data.length === 0) return null;
  const timestamps = data.map((row) => Number(row.ts)).filter((ts) => Number.isFinite(ts));
  if (timestamps.length === 0) return null;
  return [Math.min(...timestamps), Math.max(...timestamps)];
}

function clampWheelDomain(
  center: number,
  windowMs: number,
  fullMin: number,
  fullMax: number
): [number, number] {
  const span = fullMax - fullMin;
  const nextWindow = Math.min(span, Math.max(windowMs, Math.min(MIN_WINDOW_MS, span)));
  let start = center - nextWindow / 2;
  let end = center + nextWindow / 2;
  if (start < fullMin) {
    start = fullMin;
    end = fullMin + nextWindow;
  }
  if (end > fullMax) {
    end = fullMax;
    start = fullMax - nextWindow;
  }
  return [start, end];
}

export function ZoomableTimeSeriesChart({
  data,
  yAxisLabel,
  chartType,
  timeRange,
  children,
  height = 300,
  zoomDomain,
  onZoomDomainChange,
  tooltipContent: TooltipContent,
  stationCount = 1,
}: ZoomableTimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Latest zoom domain readable from the rAF callback without re-binding the
  // wheel listener on every zoom step.
  const zoomDomainRef = useRef<ZoomDomain>(zoomDomain ?? null);
  zoomDomainRef.current = zoomDomain ?? null;

  const dataExtent = useMemo(() => getDataExtent(data), [data]);

  const xDomain = useMemo((): [number | "dataMin", number | "dataMax"] => {
    if (zoomDomain) return zoomDomain;
    if (dataExtent) return dataExtent;
    return ["dataMin", "dataMax"];
  }, [zoomDomain, dataExtent]);

  const ChartComponent = chartType === "line" ? LineChart : chartType === "area" ? AreaChart : BarChart;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onZoomDomainChange || !dataExtent) return;

    // Accumulate wheel deltas and apply at most one zoom update per animation
    // frame, instead of re-rendering every chart on every wheel event.
    let pendingDeltaY = 0;
    let pendingClientX = 0;
    let frame: number | null = null;

    const applyPendingZoom = () => {
      frame = null;
      const deltaY = pendingDeltaY;
      const clientX = pendingClientX;
      pendingDeltaY = 0;
      if (deltaY === 0) return;

      const [fullMin, fullMax] = dataExtent;
      const [curMin, curMax] = zoomDomainRef.current ?? dataExtent;
      const range = curMax - curMin;

      const rect = el.getBoundingClientRect();
      let center = (curMin + curMax) / 2;
      if (rect.width > 0) {
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        center = curMin + ratio * range;
      }

      // Scale the zoom step by how many "notches" accumulated this frame
      const notches = Math.min(4, Math.max(1, Math.round(Math.abs(deltaY) / 100)));
      const factor = Math.pow(deltaY > 0 ? 1.2 : 0.8, notches);
      onZoomDomainChange(clampWheelDomain(center, range * factor, fullMin, fullMax));
    };

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      pendingDeltaY += e.deltaY;
      pendingClientX = e.clientX;
      if (frame === null) {
        frame = requestAnimationFrame(applyPendingZoom);
      }
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [dataExtent, onZoomDomainChange]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        No data for this time range
      </div>
    );
  }

  return (
    <div ref={containerRef} className="touch-pan-y" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={data}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={xDomain}
            allowDataOverflow
            tickFormatter={(value) => formatAxisTimeForRange(value, timeRange)}
            tick={{ fontSize: 12 }}
            angle={stationCount > 2 ? -45 : 0}
            textAnchor={stationCount > 2 ? "end" : "middle"}
            height={stationCount > 2 ? 80 : 30}
            minTickGap={timeRange === "1y" ? 48 : timeRange === "30d" ? 32 : 16}
          />
          <YAxis
            label={{ value: yAxisLabel, angle: -90, position: "insideLeft" }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={TooltipContent ? <TooltipContent data={data} /> : undefined}
            shared
            labelFormatter={(value) =>
              new Date(Number(value)).toLocaleString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })
            }
          />
          <Legend
            wrapperStyle={{ paddingTop: "12px" }}
            iconType={chartType === "line" ? "line" : "square"}
          />
          {children}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

export type { ChartType, ZoomDomain };
