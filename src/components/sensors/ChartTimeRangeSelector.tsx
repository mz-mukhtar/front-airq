"use client";

import { Button } from "@/components/ui/button";
import { DateRangeFields } from "@/components/ui/date-range-fields";
import {
  CHART_TIME_RANGE_OPTIONS,
  ChartTimeRange,
  defaultCustomRange,
  todayInEat,
  validateCustomRange,
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
  const isCustom = value.preset === "custom";

  return (
    <div className="flex flex-col gap-2">
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
              variant={value.preset === option.id ? "default" : "ghost"}
              className={
                value.preset === option.id
                  ? "h-8"
                  : "h-8 text-muted-foreground hover:text-foreground"
              }
              disabled={disabled}
              title={option.description}
              aria-pressed={value.preset === option.id}
              onClick={() => onChange({ preset: option.id })}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={isCustom ? "default" : "ghost"}
            className={
              isCustom ? "h-8" : "h-8 text-muted-foreground hover:text-foreground"
            }
            disabled={disabled}
            title="Type an exact start and end date"
            aria-pressed={isCustom}
            // Seeded with the last 7 days so the charts have something to show
            // the moment custom is picked.
            onClick={() => !isCustom && onChange(defaultCustomRange())}
          >
            Custom
          </Button>
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

      {isCustom && (
        <DateRangeFields
          idPrefix="chart-range"
          value={value}
          max={todayInEat()}
          disabled={disabled}
          validate={(draft) => validateCustomRange({ preset: "custom", ...draft })}
          hint={
            value.startTime !== undefined || value.endTime !== undefined
              ? "Start and end times are inclusive, in Addis Ababa time."
              : "Both days are included in full, in Addis Ababa time."
          }
          onApply={({ start, end, startTime, endTime }) =>
            onChange({ preset: "custom", start, end, startTime, endTime })
          }
        />
      )}
    </div>
  );
}
