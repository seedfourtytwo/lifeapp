import { shiftDateString } from '../protocol';

/** Hard stop on calendar days walked, so a never-scheduled habit cannot loop forever. */
const MAX_CALENDAR_SPAN = 36_600;

export interface StreakRun {
  /** Length of the run. */
  count: number;
  /**
   * True when the run was still unbroken at `windowStart` — the data ran out, not the
   * streak, so a caller holding older data should extend the window and recompute.
   */
  truncated: boolean;
}

function previousDateString(dateStr: string): string {
  return shiftDateString(dateStr, -1);
}

function walkRun(
  completed: ReadonlySet<string>,
  startCursor: string,
  wantCompleted: boolean,
  isScheduledOnDate: (date: string) => boolean,
  maxLookback: number,
  createdOn?: string | null,
  windowStart?: string | null,
): StreakRun {
  let cursor = startCursor;
  let count = 0;
  // Only scheduled days count against the budget; unscheduled days are free.
  for (let walked = 0; walked < MAX_CALENDAR_SPAN && count < maxLookback; walked++) {
    if (createdOn && cursor < createdOn) break;
    if (windowStart && cursor < windowStart) return { count, truncated: true };
    if (isScheduledOnDate(cursor)) {
      if (completed.has(cursor) !== wantCompleted) break;
      count++;
    }
    cursor = previousDateString(cursor);
  }
  return { count, truncated: false };
}

/**
 * Like `computeStreak`, also reporting whether the run reached `windowStart`
 * (the oldest date the caller loaded) still unbroken.
 */
export function computeStreakRun(
  completedDates: Iterable<string>,
  today: string,
  isScheduledOnDate: (date: string) => boolean = () => true,
  maxLookback = Number.POSITIVE_INFINITY,
  createdOn?: string | null,
  windowStart?: string | null,
): StreakRun {
  const completed = new Set(completedDates);
  const cursor = completed.has(today) ? today : previousDateString(today);
  return walkRun(completed, cursor, true, isScheduledOnDate, maxLookback, createdOn, windowStart);
}

/** Like `computeFailureStreak`, also reporting window truncation. */
export function computeFailureStreakRun(
  completedDates: Iterable<string>,
  today: string,
  isScheduledOnDate: (date: string) => boolean = () => true,
  maxLookback = Number.POSITIVE_INFINITY,
  createdOn?: string | null,
  windowStart?: string | null,
): StreakRun {
  const completed = new Set(completedDates);
  if (completed.has(today)) return { count: 0, truncated: false };
  return walkRun(
    completed,
    previousDateString(today),
    false,
    isScheduledOnDate,
    maxLookback,
    createdOn,
    windowStart,
  );
}

/**
 * Consecutive scheduled days completed, ending today (if done) or yesterday.
 * Unscheduled days do not count against `maxLookback` (a cap on scheduled days,
 * unbounded by default). When `createdOn` is set, days before that date are
 * ignored (new habits don't inherit year of misses).
 */
export function computeStreak(
  completedDates: Iterable<string>,
  today: string,
  isScheduledOnDate: (date: string) => boolean = () => true,
  maxLookback = Number.POSITIVE_INFINITY,
  createdOn?: string | null,
): number {
  return computeStreakRun(completedDates, today, isScheduledOnDate, maxLookback, createdOn).count;
}

/**
 * Consecutive scheduled days missed, ending yesterday when today is still open.
 * Returns 0 when today is complete (no active failure streak).
 * When `createdOn` is set, days before that date are ignored.
 */
export function computeFailureStreak(
  completedDates: Iterable<string>,
  today: string,
  isScheduledOnDate: (date: string) => boolean = () => true,
  maxLookback = Number.POSITIVE_INFINITY,
  createdOn?: string | null,
): number {
  return computeFailureStreakRun(completedDates, today, isScheduledOnDate, maxLookback, createdOn)
    .count;
}
