import { z } from 'zod';
import { timeToMinutes } from '../utils/time';
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

function dateFromString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = dateFromString(startDate);
  const end = dateFromString(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function isScheduleActiveOnDate(schedule: HabitSchedule, dateStr: string): boolean {
  const date = dateFromString(dateStr);

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

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatScheduleDescription(schedule: HabitSchedule): string {
  switch (schedule.type) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return schedule.days.map((day) => WEEKDAY_LABELS[day]).join(', ');
    case 'every_n_days':
      return schedule.interval === 1
        ? 'Every day'
        : `Every ${schedule.interval} days`;
    default:
      return 'Every day';
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
