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

/** Hard stop on weeks walked (≈ the same span as `MAX_CALENDAR_SPAN`). */
const MAX_WEEK_SPAN = Math.ceil(MAX_CALENDAR_SPAN / 7);

function completedInRange(
  completed: ReadonlySet<string>,
  from: string,
  through: string,
  createdOn?: string | null,
): number {
  let count = 0;
  for (let cursor = from; cursor <= through; cursor = shiftDateString(cursor, 1)) {
    if (createdOn && cursor < createdOn) continue;
    if (completed.has(cursor)) count++;
  }
  return count;
}

/** What a weekly walk needs: which days are done, the target, and the walk's bounds. */
export interface WeeklyStreakInput {
  completedDates: Iterable<string>;
  today: string;
  /** Completed days a Monday–Sunday week needs. */
  times: number;
  /** Monday of a date's week (`weekStartDateString`). */
  weekStartOf: (date: string) => string;
  createdOn?: string | null;
  windowStart?: string | null;
}

/**
 * `times_per_week` success streak, in weeks: consecutive past weeks that met
 * the target, plus the current week once it has met it. The current, unfinished
 * week never breaks the run. The creation week (habit did not exist all week)
 * counts if met and otherwise ends the walk without breaking it. Days before
 * `createdOn` never count as completed.
 */
export function computeWeeklyStreakRun(input: WeeklyStreakInput): StreakRun {
  const completed = new Set(input.completedDates);
  const { today, times, weekStartOf, createdOn, windowStart } = input;
  const currentStart = weekStartOf(today);
  let count = completedInRange(completed, currentStart, today, createdOn) >= times ? 1 : 0;
  if (createdOn && currentStart <= createdOn) return { count, truncated: false };

  let weekStart = shiftDateString(currentStart, -7);
  for (let walked = 0; walked < MAX_WEEK_SPAN; walked++) {
    const weekEnd = shiftDateString(weekStart, 6);
    if (createdOn && weekEnd < createdOn) break;
    if (windowStart && weekStart < windowStart) return { count, truncated: true };
    const met = completedInRange(completed, weekStart, weekEnd, createdOn) >= times;
    const creationWeek = Boolean(createdOn && weekStart < createdOn);
    if (met) count++;
    if (!met || creationWeek) break;
    weekStart = shiftDateString(weekStart, -7);
  }
  return { count, truncated: false };
}

/**
 * `times_per_week` failure streak: consecutive past *full* weeks that missed
 * the target, ending last week. 0 once the current week has met the target.
 * The creation week is not a full week, so it is never counted as missed.
 */
export function computeWeeklyFailureStreakRun(input: WeeklyStreakInput): StreakRun {
  const completed = new Set(input.completedDates);
  const { today, times, weekStartOf, createdOn, windowStart } = input;
  const currentStart = weekStartOf(today);
  if (completedInRange(completed, currentStart, today, createdOn) >= times) {
    return { count: 0, truncated: false };
  }

  let count = 0;
  let weekStart = shiftDateString(currentStart, -7);
  for (let walked = 0; walked < MAX_WEEK_SPAN; walked++) {
    if (createdOn && weekStart < createdOn) break;
    if (windowStart && weekStart < windowStart) return { count, truncated: true };
    const weekEnd = shiftDateString(weekStart, 6);
    if (completedInRange(completed, weekStart, weekEnd, createdOn) >= times) break;
    count++;
    weekStart = shiftDateString(weekStart, -7);
  }
  return { count, truncated: false };
}
