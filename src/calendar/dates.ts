import { toDateString } from '../protocol/event';

/** Local calendar date at 00:00. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addLocalMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const day = date.getDate();
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return next;
}

export function addLocalYears(date: Date, years: number): Date {
  return addLocalMonths(date, years * 12);
}

export function parseDateOnlyLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Format a Date as local ISO with offset, e.g. 2026-07-20T15:00:00.000+02:00 */
export function toLocalOffsetIso(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${oh}:${om}`
  );
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function defaultTimedEnd(start: Date): Date {
  return new Date(start.getTime() + 60 * 60 * 1000);
}

export function monthGridRange(year: number, monthIndex: number): { start: Date; end: Date } {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const endPad = (7 - ((last.getDay() + 6) % 7) - 1 + 7) % 7;
  const start = addLocalDays(first, -startPad);
  const end = addLocalDays(addLocalDays(last, endPad + 1), 0); // exclusive next day after last cell
  return { start: startOfLocalDay(start), end: startOfLocalDay(end) };
}

export { toDateString };
