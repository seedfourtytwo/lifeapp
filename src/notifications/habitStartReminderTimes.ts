import { normalizeReminderTimes, toDateString } from '../protocol';
import type { HabitConfig } from '../protocol';
import { isScheduleActiveOnDate, isScheduleSupportedForReminders } from '../protocol/schedule';
import { timeToMinutes } from '../utils/time';

/** How far ahead to schedule DATE reminders (refreshed on each sync). */
export const START_REMINDER_HORIZON_DAYS = 14;

export function reminderTimeFromRange(
  start: string,
  remindMinutesBefore: number,
): { hour: number; minute: number } {
  const startMinutes = timeToMinutes(start);
  const total = Math.max(0, startMinutes - remindMinutesBefore);
  return {
    hour: Math.floor(total / 60),
    minute: total % 60,
  };
}

function formatHHmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Every clock time a habit reminds at on a scheduled day: its own reminder
 * times, plus the one before its time window when that is set. A time both
 * name is one reminder.
 */
export function habitReminderClockTimes(config: HabitConfig): string[] {
  const times = [...config.reminderTimes];
  if (
    config.timeRange &&
    config.remindMinutesBefore !== undefined &&
    isScheduleSupportedForReminders(config.schedule)
  ) {
    const { hour, minute } = reminderTimeFromRange(
      config.timeRange.start,
      config.remindMinutesBefore,
    );
    times.push(formatHHmm(hour, minute));
  }
  return normalizeReminderTimes(times);
}

function addCalendarDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return toDateString(new Date(year, month - 1, day + days));
}

/** Local wall-clock time; a time the spring change skips lands an hour later. */
function buildLocalDateTime(dateStr: string, time: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export type StartReminderFire = {
  /** YYYY-MM-DD — used in the notification identifier. */
  dateStr: string;
  /** HH:mm as configured — used in the notification identifier. */
  time: string;
  /** Days after today; today is 0. */
  dayOffset: number;
  when: Date;
};

/**
 * Next reminder fire times over a short horizon, on the days the schedule is due.
 * Skips the rest of today when the habit is already done (DATE triggers can do
 * that; DAILY cannot).
 */
export function collectStartReminderFires(
  config: HabitConfig,
  opts: { now?: Date; doneToday: boolean; horizonDays?: number },
): StartReminderFire[] {
  const times = habitReminderClockTimes(config);
  if (times.length === 0) return [];

  const now = opts.now ?? new Date();
  const horizonDays = opts.horizonDays ?? START_REMINDER_HORIZON_DAYS;
  const today = toDateString(now);
  const fires: StartReminderFire[] = [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    if (dayOffset === 0 && opts.doneToday) continue;
    const dateStr = addCalendarDays(today, dayOffset);
    if (!isScheduleActiveOnDate(config.schedule, dateStr)) continue;

    for (const time of times) {
      const when = buildLocalDateTime(dateStr, time);
      if (when.getTime() <= now.getTime()) continue;
      fires.push({ dateStr, time, dayOffset, when });
    }
  }

  return fires;
}

/**
 * The fires that fit in `budget`. Whole days are kept from today onward, as
 * many as fit, so a crowded list shortens the horizon rather than silencing a
 * habit. Only if today alone is over budget are the earliest kept.
 */
export function fitFiresToBudget<T extends { dayOffset: number; when: Date }>(
  fires: readonly T[],
  budget: number,
): T[] {
  if (fires.length <= budget) return [...fires];
  const lastOffset = Math.max(...fires.map((fire) => fire.dayOffset));
  for (let horizon = lastOffset; horizon > 0; horizon--) {
    const kept = fires.filter((fire) => fire.dayOffset < horizon);
    if (kept.length <= budget) return kept;
  }
  return [...fires].sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, budget);
}
