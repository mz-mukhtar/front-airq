"use client";

import { Button } from "@/components/ui/button";
import {
  CHART_TIME_RANGE_OPTIONS,
  ChartTimeRange,
} from "@/lib/utils/chart-time-range";
import { RotateCcw } from "lucide-react";

interface ChartTimeRangeSelectorProps {
  value: ChartTimeRange;
  onChange: (range: ChartTimeRange) => void;
  onResetZoom?: () => void;
  zoomActive?: boolean;
  refreshing?: boolean;
  disabled?: boolean;
}

export function ChartTimeRangeSelector({
  value,
  onChange,
  onResetZoom,
  zoomActive,
  refreshing,
  disabled,
}: ChartTimeRangeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Time range
      </span>
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {CHART_TIME_RANGE_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={value === option.id ? "default" : "ghost"}
            className={
              value === option.id
                ? "h-8 bg-[#016FC4] text-white hover:bg-[#015a9e]"
                : "h-8 text-muted-foreground hover:text-foreground"
            }
            disabled={disabled}
            title={option.description}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {zoomActive && onResetZoom && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={onResetZoom}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset zoom
        </Button>
      )}
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {refreshing ? "Updating charts…" : "Use the timeline scrubber to pan and zoom all charts together"}
      </span>
    </div>
  );
}
