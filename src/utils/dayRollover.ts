import { toDateString } from '../protocol';

/** Calendar date used for daily habits and counters (device local time). */
export function currentAppCalendarDate(now = new Date()): string {
  return toDateString(now);
}

export function hasAppCalendarDayChanged(previousDate: string, now = new Date()): boolean {
  return currentAppCalendarDate(now) !== previousDate;
}

/** Display label for the daily reset boundary — must match `msUntilNextAppDay`. */
export const APP_DAY_RESET_TIME_LABEL = '00:00';

/** Milliseconds until the next local midnight (minimum 1s). */
export function msUntilNextAppDay(now = new Date()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(nextMidnight.getTime() - now.getTime(), 1_000);
}
