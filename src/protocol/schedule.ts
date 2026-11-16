import { z } from 'zod';
import { i18n } from '../i18n';
import { timeToMinutes } from '../utils/time';
import { parseLocalDate, shiftDateString } from './event';
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
  /**
   * "N times a week": any N days of the Monday–Sunday week (device-local dates).
   * Which days count depends on what was done earlier that week, so due-ness is
   * answered by `isScheduleDueOnDate`, not `isScheduleActiveOnDate`.
   */
  z.object({
    type: z.literal('times_per_week'),
    times: z.number().int().min(1).max(6),
  }),
]);

export type HabitSchedule = z.infer<typeof HabitScheduleSchema>;

function utcDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Whole calendar days from `startDate` to `endDate` (YYYY-MM-DD); timezone and DST independent. */
export function daysBetween(startDate: string, endDate: string): number {
  return utcDayNumber(endDate) - utcDayNumber(startDate);
}

/** Monday (YYYY-MM-DD) of the Monday–Sunday week holding `dateStr`. Pure date arithmetic. */
export function weekStartDateString(dateStr: string): string {
  const dayNumber = utcDayNumber(dateStr);
  // Day 0 (1970-01-01) was a Thursday: (n + 3) % 7 is 0 on Mondays.
  const offset = (((dayNumber + 3) % 7) + 7) % 7;
  return shiftDateString(dateStr, -offset);
}

/** Completed days in `dateStr`'s week strictly before `dateStr`. */
export function completedDaysInWeekBefore(
  dateStr: string,
  completedDates: ReadonlySet<string>,
): number {
  let count = 0;
  for (let cursor = weekStartDateString(dateStr); cursor < dateStr; cursor = shiftDateString(cursor, 1)) {
    if (completedDates.has(cursor)) count++;
  }
  return count;
}

/**
 * Whether the schedule *offers* `dateStr` at all, with no knowledge of history.
 * Every day is a candidate for `times_per_week`; use `isScheduleDueOnDate`
 * whenever the completed days are known.
 */
export function isScheduleActiveOnDate(schedule: HabitSchedule, dateStr: string): boolean {
  const date = parseLocalDate(dateStr);

  switch (schedule.type) {
    case 'times_per_week':
      return true;
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

/**
 * Due on `dateStr` given which days are complete (skips are a separate layer —
 * see `dayRules.ts`). For `times_per_week`: due while fewer than `times` earlier
 * days of that week are complete, or when the day itself is complete (so it
 * stays visible as done). Other schedules ignore `completedDates`.
 */
export function isScheduleDueOnDate(
  schedule: HabitSchedule,
  dateStr: string,
  completedDates: ReadonlySet<string>,
): boolean {
  if (schedule.type !== 'times_per_week') {
    return isScheduleActiveOnDate(schedule, dateStr);
  }
  if (completedDates.has(dateStr)) return true;
  return completedDaysInWeekBefore(dateStr, completedDates) < schedule.times;
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
    case 'times_per_week':
      return i18n.t('trackers:schedule.timesPerWeek', { count: schedule.times });
    default:
      return i18n.t('trackers:habitFields.everyDay');
  }
}

/** Expo notifications use 1 = Sunday … 7 = Saturday. */
export function toExpoWeekday(jsDay: number): number {
  return jsDay + 1;
}
