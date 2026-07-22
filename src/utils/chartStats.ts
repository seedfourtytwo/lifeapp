/** Pure chart/aggregation helpers for History + Insights. */

/** Trailing simple moving average; leading windows use available points. */
export function movingAverage(values: readonly number[], window: number): number[] {
  if (window <= 0) return values.map(() => 0);
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] ?? 0;
    if (i >= window) {
      sum -= values[i - window] ?? 0;
    }
    const count = Math.min(i + 1, window);
    out.push(count === 0 ? 0 : sum / count);
  }
  return out;
}

/** Normalize each series to 0–1 against its own max in range (min floor 1). */
export function normalizeSeriesToUnit(
  seriesValues: readonly (readonly number[])[],
): number[][] {
  return seriesValues.map((values) => {
    const max = Math.max(...values, 1);
    return values.map((v) => v / max);
  });
}

export interface ActivityStats {
  bestValue: number;
  bestDate: string | null;
  /** Mean of days with value > 0; 0 when none. */
  averageActive: number;
  activeDays: number;
}

/** Best day + average on active days for counter/timer ranges. */
export function computeActivityStats(
  dates: readonly string[],
  values: readonly number[],
): ActivityStats {
  let bestValue = 0;
  let bestDate: string | null = null;
  let sum = 0;
  let activeDays = 0;

  for (let i = 0; i < dates.length; i++) {
    const value = values[i] ?? 0;
    const date = dates[i];
    if (!date || value <= 0) continue;
    activeDays += 1;
    sum += value;
    if (value > bestValue || (value === bestValue && date > (bestDate ?? ''))) {
      bestValue = value;
      bestDate = date;
    }
  }

  return {
    bestValue,
    bestDate,
    averageActive: activeDays === 0 ? 0 : sum / activeDays,
    activeDays,
  };
}

/**
 * Longest consecutive scheduled-day completion streak in `completedDates`.
 * Walks chronologically through the sorted unique completed set.
 */
export function computePersonalBestStreak(
  completedDates: Iterable<string>,
  isScheduledOnDate: (date: string) => boolean = () => true,
): number {
  const completed = [...new Set(completedDates)].filter(isScheduledOnDate).sort();
  if (completed.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < completed.length; i++) {
    const prev = completed[i - 1]!;
    const next = completed[i]!;
    if (areConsecutiveScheduledDays(prev, next, isScheduledOnDate)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function dateFromString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function nextCalendarDate(dateStr: string): string {
  const d = dateFromString(dateStr);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** True when `next` is the next scheduled day after `prev` (skipping unscheduled). */
function areConsecutiveScheduledDays(
  prev: string,
  next: string,
  isScheduledOnDate: (date: string) => boolean,
): boolean {
  let cursor = nextCalendarDate(prev);
  // Cap look-ahead so a bad schedule cannot loop forever.
  for (let i = 0; i < 366; i++) {
    if (cursor === next) return isScheduledOnDate(next);
    if (cursor > next) return false;
    if (isScheduledOnDate(cursor)) return false;
    cursor = nextCalendarDate(cursor);
  }
  return false;
}

export const HISTORY_RANGES = [7, 30, 90] as const;
export type HistoryRangeDays = (typeof HISTORY_RANGES)[number];
export const DEFAULT_HISTORY_RANGE: HistoryRangeDays = 30;
export const MOVING_AVERAGE_WINDOW = 7;
export const INSIGHTS_MAX_SERIES = 5;
