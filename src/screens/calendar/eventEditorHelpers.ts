import {
  parseDateOnlyLocal,
  toDateString,
} from '../../calendar/dates';
import { getDateLocale, i18n } from '../../i18n';

export type TimeParts = { hour: string; minute: string };

export function parseTimeParts(date: Date): TimeParts {
  return {
    hour: String(date.getHours()).padStart(2, '0'),
    minute: String(date.getMinutes()).padStart(2, '0'),
  };
}

export function applyTime(base: Date, hour: string, minute: string): Date {
  const h = Math.min(23, Math.max(0, Number.parseInt(hour, 10) || 0));
  const m = Math.min(59, Math.max(0, Number.parseInt(minute, 10) || 0));
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

export function shiftDateString(dateStr: string, days: number): string {
  const d = parseDateOnlyLocal(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function formatFriendlyDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = parseDateOnlyLocal(dateStr);
  const today = toDateString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toDateString(tomorrowDate);
  if (dateStr === today) return i18n.t('common:dateTime.today');
  if (dateStr === tomorrow) return i18n.t('common:dateTime.tomorrow');
  return d.toLocaleDateString(getDateLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
