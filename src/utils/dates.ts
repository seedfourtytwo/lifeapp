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

/** Doublings allowed past the base window (365 · 2^6 days, far beyond any real history). */
export const MAX_WINDOW_EXTENSIONS = 6;

/**
 * Streak window start after `extensions` doublings of the base window
 * (365, 730, 1460 … days). The streak fetch widens it only while a run is
 * still unbroken at the window edge.
 */
export function streakWindowSinceDate(extensions = 0): string {
  return dateDaysAgo(STREAK_LOOKBACK_DAYS * 2 ** extensions);
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

/**
 * One axis label: a short weekday when a week fits, the day of the month when
 * the range is denser. Short on purpose — the full date is in the day panel.
 */
export function formatAxisLabel(dateStr: string, style: 'weekday' | 'day'): string {
  const d = parseLocalDate(dateStr);
  if (style === 'day') return String(d.getDate());
  return d.toLocaleDateString(getDateLocale(), { weekday: 'short' }).replace(/\.$/, '');
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
