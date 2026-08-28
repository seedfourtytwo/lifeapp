import { getDateLocale } from '../i18n';
import { parseLocalDate, shiftDateString, toDateString } from '../protocol';

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
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(getDateLocale(), { weekday: 'short', day: 'numeric' });
}

export function formatFullDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(getDateLocale(), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** Compact "Wed, 19 Aug" style date for home tab meta rows. */
export function formatShortDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString(getDateLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Monday of the ISO week containing `dateStr`. */
export function startOfWeekDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  // getDay(): 0 = Sunday. Sunday belongs to the week that started 6 days earlier.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toDateString(d);
}

/** The seven dates, Monday first, of the week containing `dateStr`. */
export function weekDates(dateStr: string): string[] {
  const monday = startOfWeekDate(dateStr);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(shiftDateString(monday, i));
  }
  return dates;
}
