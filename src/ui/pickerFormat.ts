import { getDateLocale } from '../i18n';
import { parseLocalDate, toDateString } from '../protocol';
import { formatLocalClockTime, parseTimeHHmm } from '../utils/time';

/**
 * What the time and date fields show, and the conversions between the app's
 * stored strings (`HH:mm`, `YYYY-MM-DD`) and the `Date` the phone's picker
 * speaks. Times read on the 24-hour clock everywhere in the app, in both
 * languages; dates take the app language's names for days and months.
 */

/** A stored time as shown: "07:30". */
export function formatPickedTime(hhmm: string): string {
  return parseTimeHHmm(hhmm) ?? '';
}

/** A stored date as shown: "Wed, 11 Nov", with the year only when it is not this one. */
export function formatPickedDate(date: string, today: string): string {
  const day = parseLocalDate(date);
  if (Number.isNaN(day.getTime())) return '';
  return day.toLocaleDateString(getDateLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  });
}

/** The moment the time picker opens on: that time today, or now's whole hour when none is set. */
export function timeAsDate(hhmm: string | null, now: Date): Date {
  const at = new Date(now);
  const valid = hhmm ? parseTimeHHmm(hhmm) : null;
  if (!valid) {
    at.setMinutes(0, 0, 0);
    return at;
  }
  const [hours, minutes] = valid.split(':').map(Number);
  at.setHours(hours!, minutes!, 0, 0);
  return at;
}

/** The time the picker answered with, as stored. */
export function dateAsTime(picked: Date): string {
  return formatLocalClockTime(picked);
}

/** The day the date picker opens on. */
export function dayAsDate(date: string | null, today: string): Date {
  const day = parseLocalDate(date ?? today);
  return Number.isNaN(day.getTime()) ? parseLocalDate(today) : day;
}

/** The day the picker answered with, as stored. */
export function dateAsDay(picked: Date): string {
  return toDateString(picked);
}

/** A typed date (the fallback off the phone), or null when it is not a real day. */
export function parseTypedDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const day = parseLocalDate(trimmed);
  return !Number.isNaN(day.getTime()) && toDateString(day) === trimmed ? trimmed : null;
}
