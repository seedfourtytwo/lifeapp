import { toDateString } from '../protocol';

/** Days of history used for streak calculations (inclusive window). */
export const STREAK_LOOKBACK_DAYS = 365;

export function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateString(d);
}

/** Earliest calendar date included in streak history queries. */
export function streakHistorySinceDate(): string {
  return dateDaysAgo(STREAK_LOOKBACK_DAYS);
}

export function lastNDates(count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(toDateString(d));
  }
  return dates;
}

export function formatChartLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

export function formatFullDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
