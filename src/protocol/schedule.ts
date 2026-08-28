import { z } from 'zod';
import { i18n } from '../i18n';
import { timeToMinutes } from '../utils/time';
import { parseLocalDate } from './event';
import type { HabitTimeRange } from './kinds/habit';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const WeekdaySchema = z.number().int().min(0).max(6);

export const HabitScheduleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({
    type: z.literal('weekdays'),
    days: z.array(WeekdaySchema).min(1),
  }),
  z.object({
    type: z.literal('every_n_days'),
    interval: z.number().int().min(1),
    anchorDate: z.string().regex(DATE_RE),
  }),
]);

export type HabitSchedule = z.infer<typeof HabitScheduleSchema>;

export function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function isScheduleActiveOnDate(schedule: HabitSchedule, dateStr: string): boolean {
  const date = parseLocalDate(dateStr);

  switch (schedule.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return schedule.days.includes(date.getDay());
    case 'every_n_days': {
      const elapsed = daysBetween(schedule.anchorDate, dateStr);
      if (elapsed < 0) return false;
      return elapsed % schedule.interval === 0;
    }
    default:
      return true;
  }
}

export function isTimeRangeStartingSoon(
  timeRange: HabitTimeRange | undefined,
  now = new Date(),
  withinHours = 2,
): boolean {
  if (!timeRange) {
    return false;
  }

  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(timeRange.start);
  const windowEnd = current + withinHours * 60;

  return start >= current && start <= windowEnd;
}

const WEEKDAY_SHORT_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function formatScheduleDescription(schedule: HabitSchedule): string {
  switch (schedule.type) {
    case 'daily':
      return i18n.t('trackers:habitFields.everyDay');
    case 'weekdays': {
      const days = [...schedule.days].sort();
      if (days.length === 5 && days.join(',') === '1,2,3,4,5') {
        return i18n.t('trackers:schedule.weekdays');
      }
      if (days.length === 2 && days.join(',') === '0,6') {
        return i18n.t('trackers:schedule.weekends');
      }
      return days
        .map((day) => i18n.t(`common:weekdaysShort.${WEEKDAY_SHORT_KEYS[day]}`))
        .join(', ');
    }
    case 'every_n_days':
      return schedule.interval === 1
        ? i18n.t('trackers:habitFields.everyDay')
        : i18n.t('trackers:schedule.everyNDays', { count: schedule.interval });
    default:
      return i18n.t('trackers:habitFields.everyDay');
  }
}

/** Daily and weekday schedules support recurring local reminders. */
export function isScheduleSupportedForReminders(schedule: HabitSchedule): boolean {
  return schedule.type === 'daily' || schedule.type === 'weekdays';
}

/** Expo notifications use 1 = Sunday … 7 = Saturday. */
export function toExpoWeekday(jsDay: number): number {
  return jsDay + 1;
}
