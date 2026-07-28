"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A typed window. Times are optional and stay absent unless the user asks for
 * them, in which case the range covers whole days.
 */
export interface TypedDateRange {
  start?: string;
  end?: string;
  /** HH:mm. Absent means the start of the first day. */
  startTime?: string;
  /** HH:mm. Absent means the end of the last day. */
  endTime?: string;
}

/** What the whole-day default expands to when times are switched on. */
export const DEFAULT_START_TIME = "00:00";
export const DEFAULT_END_TIME = "23:59";

interface DateRangeFieldsProps {
  /** The applied range. Editing the inputs does not change it until Apply. */
  value: TypedDateRange;
  onApply: (range: TypedDateRange & { start: string; end: string }) => void;
  /** Returns why the typed range is unusable, or null when it is fine. */
  validate: (range: TypedDateRange) => string | null;
  /** Latest selectable day, YYYY-MM-DD. */
  max?: string;
  disabled?: boolean;
  /** Distinguishes the input ids when two of these are on one page. */
  idPrefix: string;
  /** Shown when the range is applied and valid. */
  hint?: string;
  className?: string;
}

/**
 * Two typed dates, optional times, and an Apply button.
 *
 * The draft is held locally so a half-typed range never triggers a fetch —
 * "2026-07-1" is a valid date string on the way to "2026-07-15", and querying
 * it would be both wrong and slow. The applied value only moves on Apply (or
 * Enter), and syncs back down when the range is changed from elsewhere.
 *
 * Times are opt-in: the range is whole days until the user switches them on,
 * and switching them on pre-fills the same whole-day boundaries, so revealing
 * the fields never changes the window by itself.
 */
export function DateRangeFields({
  value,
  onApply,
  validate,
  max,
  disabled,
  idPrefix,
  hint = "Both days are included.",
  className = "",
}: DateRangeFieldsProps) {
  const [draftStart, setDraftStart] = useState(value.start ?? "");
  const [draftEnd, setDraftEnd] = useState(value.end ?? "");
  const [draftStartTime, setDraftStartTime] = useState(
    value.startTime ?? DEFAULT_START_TIME
  );
  const [draftEndTime, setDraftEndTime] = useState(value.endTime ?? DEFAULT_END_TIME);
  const [showTimes, setShowTimes] = useState(
    value.startTime !== undefined || value.endTime !== undefined
  );

  // When the applied range moves for any reason other than this component's own
  // Apply (a preset button, a URL change), the draft follows it. Adjusting state
  // during render is React's prescribed way to do this — an effect would render
  // the stale draft once first.
  const [syncedTo, setSyncedTo] = useState(value);
  if (
    syncedTo.start !== value.start ||
    syncedTo.end !== value.end ||
    syncedTo.startTime !== value.startTime ||
    syncedTo.endTime !== value.endTime
  ) {
    setSyncedTo(value);
    setDraftStart(value.start ?? "");
    setDraftEnd(value.end ?? "");
    setDraftStartTime(value.startTime ?? DEFAULT_START_TIME);
    setDraftEndTime(value.endTime ?? DEFAULT_END_TIME);
    setShowTimes(value.startTime !== undefined || value.endTime !== undefined);
  }

  // Times only reach the applied range while the fields are showing; hiding them
  // puts the window back to whole days.
  const draft: TypedDateRange = {
    start: draftStart,
    end: draftEnd,
    startTime: showTimes ? draftStartTime : undefined,
    endTime: showTimes ? draftEndTime : undefined,
  };

  const error = validate(draft);
  const dirty =
    draft.start !== value.start ||
    draft.end !== value.end ||
    draft.startTime !== value.startTime ||
    draft.endTime !== value.endTime;

  const apply = () => {
    if (error || !draftStart || !draftEnd) return;
    onApply({ ...draft, start: draftStart, end: draftEnd });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") apply();
  };

  const fieldClass = "h-8 rounded-md border bg-background px-2 text-sm";
  const labelClass = "text-xs font-medium text-muted-foreground";

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 ${className}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-start`} className={labelClass}>
            From
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={`${idPrefix}-start`}
              type="date"
              value={draftStart}
              max={draftEnd || max}
              disabled={disabled}
              onChange={(e) => setDraftStart(e.target.value)}
              onKeyDown={onKeyDown}
              className={fieldClass}
            />
            {showTimes && (
              <input
                aria-label="Start time"
                type="time"
                value={draftStartTime}
                disabled={disabled}
                onChange={(e) => setDraftStartTime(e.target.value)}
                onKeyDown={onKeyDown}
                className={fieldClass}
              />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-end`} className={labelClass}>
            To
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={`${idPrefix}-end`}
              type="date"
              value={draftEnd}
              min={draftStart || undefined}
              max={max}
              disabled={disabled}
              onChange={(e) => setDraftEnd(e.target.value)}
              onKeyDown={onKeyDown}
              className={fieldClass}
            />
            {showTimes && (
              <input
                aria-label="End time"
                type="time"
                value={draftEndTime}
                disabled={disabled}
                onChange={(e) => setDraftEndTime(e.target.value)}
                onKeyDown={onKeyDown}
                className={fieldClass}
              />
            )}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={disabled || !!error || !dirty}
          onClick={apply}
        >
          Apply
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          disabled={disabled}
          // Revealing the fields keeps the current window: they start at the
          // whole-day boundaries the range already used.
          onClick={() => {
            if (showTimes) {
              setDraftStartTime(DEFAULT_START_TIME);
              setDraftEndTime(DEFAULT_END_TIME);
            }
            setShowTimes((shown) => !shown);
          }}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
        >
          {showTimes ? "Use whole days" : "Set a time of day"}
        </button>
        <span className="text-xs text-muted-foreground">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : dirty ? (
            "Press Apply to load this range."
          ) : (
            hint
          )}
        </span>
      </div>
    </div>
  );
}
