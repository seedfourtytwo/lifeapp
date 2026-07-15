import { toDateString } from '../protocol';

/** Calendar date used for daily habits and counters (device local time). */
export function currentAppCalendarDate(now = new Date()): string {
  return toDateString(now);
}

export function hasAppCalendarDayChanged(previousDate: string, now = new Date()): boolean {
  return currentAppCalendarDate(now) !== previousDate;
}

/** Milliseconds until the next local midnight (minimum 1s). */
export function msUntilNextAppDay(now = new Date()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(nextMidnight.getTime() - now.getTime(), 1_000);
}
