import { toDateString } from '../protocol';
import type { HabitConfig } from '../protocol';
import { isScheduleDueOnDate } from '../protocol/schedule';
import { timeToMinutes } from '../utils/time';

/** How far ahead to schedule DATE start reminders (refreshed on each sync). */
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

function addCalendarDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return toDateString(new Date(year, month - 1, day + days));
}

function buildLocalDateTime(dateStr: string, hour: number, minute: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export type StartReminderFire = {
  /** YYYY-MM-DD — used in the notification identifier. */
  dateStr: string;
  when: Date;
};

/**
 * Next reminder fire times over a short horizon.
 * Skips today when the habit is already done or skipped (DATE triggers can do
 * that; DAILY cannot).
 *
 * `times_per_week`: a day gets a reminder while the habit is still due on it as
 * far as is known now — this week's done days (`weekDoneBefore` + today) can
 * already rule out the rest of the week, but nothing can rule out a future
 * week, so every later day is scheduled. Ticking it off changes the store, the
 * reminder signature changes, and the resync drops the days no longer due. A
 * week finished elsewhere (the widget) while the app is closed keeps its fires
 * until the app next syncs.
 */
export function collectStartReminderFires(
  config: HabitConfig,
  opts: {
    now?: Date;
    doneToday: boolean;
    /** Today holds a skip row and is not done: no reminder today. */
    skippedToday?: boolean;
    /** `times_per_week` only: this week's completed dates before today. */
    weekDoneBefore?: readonly string[];
    horizonDays?: number;
  },
): StartReminderFire[] {
  if (!config.timeRange || config.remindMinutesBefore === undefined) {
    return [];
  }

  const now = opts.now ?? new Date();
  const horizonDays = opts.horizonDays ?? START_REMINDER_HORIZON_DAYS;
  const { hour, minute } = reminderTimeFromRange(
    config.timeRange.start,
    config.remindMinutesBefore,
  );
  const today = toDateString(now);
  const fires: StartReminderFire[] = [];
  const completed = new Set(opts.weekDoneBefore ?? []);
  if (opts.doneToday) completed.add(today);

  for (let offset = 0; offset < horizonDays; offset++) {
    const dateStr = addCalendarDays(today, offset);
    if (offset === 0 && (opts.doneToday || opts.skippedToday)) continue;
    if (!isScheduleDueOnDate(config.schedule, dateStr, completed)) continue;

    const when = buildLocalDateTime(dateStr, hour, minute);
    if (when.getTime() <= now.getTime()) continue;

    fires.push({ dateStr, when });
  }

  return fires;
}
