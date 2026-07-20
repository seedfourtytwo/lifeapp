import { toDateString } from '../protocol/event';
import type { CalendarOccurrence } from './types';
import { REMINDER_PRESET_OPTIONS } from './defaults';

export function formatOccurrenceTime(occ: CalendarOccurrence): string {
  if (occ.allDay) return 'All day';
  const start = formatTime(occ.start);
  const end = formatTime(occ.end);
  return `${start} – ${end}`;
}

export function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDayHeading(date: Date): string {
  const today = toDateString(new Date());
  const target = toDateString(date);
  if (target === today) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target === toDateString(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function formatReminderOffset(offsetMinutes: number): string {
  const preset = REMINDER_PRESET_OPTIONS.find((p) => p.offsetMinutes === offsetMinutes);
  if (preset) return preset.label;
  if (offsetMinutes === 0) return 'At time';
  if (offsetMinutes < 60) return `${offsetMinutes} min before`;
  if (offsetMinutes < 60 * 24) {
    const hours = Math.round(offsetMinutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} before`;
  }
  const days = Math.round(offsetMinutes / (60 * 24));
  return `${days} day${days === 1 ? '' : 's'} before`;
}
