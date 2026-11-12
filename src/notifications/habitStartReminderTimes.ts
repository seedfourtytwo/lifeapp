import { normalizeReminderTimes } from '../protocol';
import type { HabitConfig, HabitSchedule } from '../protocol';
import { isScheduleActiveOnDate, isScheduleSupportedForReminders } from '../protocol/schedule';
import { timeToMinutes } from '../utils/time';

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

/** Local wall-clock time; a time the spring change skips lands an hour later. */
function buildLocalDateTime(dateStr: string, time: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * The moments a habit reminds at on a local date: each reminder time on a
 * day its schedule is due, none otherwise. A time the spring change skips
 * fires an hour later; one the autumn change repeats fires the first time.
 * The native scheduler (`ReminderRules.kt`) runs the same cases.
 */
export function reminderMomentsOn(
  schedule: HabitSchedule,
  reminderTimes: readonly string[],
  dateStr: string,
): Date[] {
  if (!isScheduleActiveOnDate(schedule, dateStr)) return [];
  return reminderTimes.map((time) => buildLocalDateTime(dateStr, time));
}
