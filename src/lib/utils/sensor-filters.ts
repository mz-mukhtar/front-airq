import { SensorReadingsParams } from "@/lib/api/types";

/** Remove undefined/null keys so API query strings stay clean. */
export function compactFilters(filters: SensorReadingsParams): SensorReadingsParams {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as SensorReadingsParams;
}

/**
 * Ensure only one time-range strategy is active.
 * Custom start/end dates take priority over quick filters and relative windows.
 */
export function normalizeSensorTimeFilters(filters: SensorReadingsParams): SensorReadingsParams {
  const next: SensorReadingsParams = { ...filters };

  const hasCustomRange = Boolean(next.start_date || next.end_date);
  const hasRecordedDate = Boolean(next.recorded_date);
  const hasRelativeWindow = next.hours !== undefined || next.days !== undefined;
  const hasQuickFilter = Boolean(
    next.today || next.yesterday || next.this_week || next.this_month
  );

  if (hasCustomRange) {
    delete next.today;
    delete next.yesterday;
    delete next.this_week;
    delete next.this_month;
    delete next.hours;
    delete next.days;
    delete next.recorded_date;
    return next;
  }

  if (hasRecordedDate) {
    delete next.today;
    delete next.yesterday;
    delete next.this_week;
    delete next.this_month;
    delete next.hours;
    delete next.days;
    delete next.start_date;
    delete next.end_date;
    return next;
  }

  if (hasRelativeWindow) {
    delete next.today;
    delete next.yesterday;
    delete next.this_week;
    delete next.this_month;
    delete next.start_date;
    delete next.end_date;
    delete next.recorded_date;
    return next;
  }

  if (hasQuickFilter) {
    delete next.hours;
    delete next.days;
    delete next.start_date;
    delete next.end_date;
    delete next.recorded_date;
  }

  return next;
}

/** Convert datetime-local value to an ISO string for the API. */
export function datetimeLocalToApi(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

/** Extract time-range params for graph/table API calls. */
export function pickTimeFilters(filters: SensorReadingsParams): Partial<SensorReadingsParams> {
  const normalized = normalizeSensorTimeFilters(filters);
  const picked: Partial<SensorReadingsParams> = {};

  if (normalized.start_date) picked.start_date = normalized.start_date;
  if (normalized.end_date) picked.end_date = normalized.end_date;
  if (normalized.recorded_date) picked.recorded_date = normalized.recorded_date;
  if (normalized.hours !== undefined) picked.hours = normalized.hours;
  if (normalized.days !== undefined) picked.days = normalized.days;
  if (normalized.today) picked.today = normalized.today;
  if (normalized.yesterday) picked.yesterday = normalized.yesterday;
  if (normalized.this_week) picked.this_week = normalized.this_week;
  if (normalized.this_month) picked.this_month = normalized.this_month;
  if (normalized.timezone) picked.timezone = normalized.timezone;

  return picked;
}
