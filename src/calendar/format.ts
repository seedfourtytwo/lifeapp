import { getDateLocale, i18n } from '../i18n';
import { toDateString } from '../protocol/event';
import type { CalendarOccurrence } from './types';
import { REMINDER_PRESET_OPTIONS } from './defaults';

export function formatOccurrenceTime(occ: CalendarOccurrence): string {
  if (occ.allDay) return i18n.t('calendar:screen.allDayLabel');
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
  if (target === today) return i18n.t('common:dateTime.today');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target === toDateString(tomorrow)) return i18n.t('common:dateTime.tomorrow');
  return date.toLocaleDateString(getDateLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(getDateLocale(), {
    month: 'long',
    year: 'numeric',
  });
}

export function formatReminderOffset(offsetMinutes: number): string {
  const preset = REMINDER_PRESET_OPTIONS.find((p) => p.offsetMinutes === offsetMinutes);
  if (preset) return i18n.t(`calendar:${preset.labelKey}`);
  if (offsetMinutes === 0) return i18n.t('calendar:reminders.atTimeOfEvent');
  if (offsetMinutes < 60) {
    return i18n.t('calendar:reminders.minutesBeforeGeneric', { count: offsetMinutes });
  }
  if (offsetMinutes < 60 * 24) {
    const hours = Math.round(offsetMinutes / 60);
    return i18n.t(hours === 1 ? 'calendar:reminders.hoursBeforeOne' : 'calendar:reminders.hoursBeforeMany', {
      count: hours,
    });
  }
  const days = Math.round(offsetMinutes / (60 * 24));
  return i18n.t(days === 1 ? 'calendar:reminders.daysBeforeOne' : 'calendar:reminders.daysBeforeMany', {
    count: days,
  });
}
