import type { LifeEvent } from './event';
import {
  isScheduleActiveOnDate,
  isScheduleDueOnDate,
  type HabitSchedule,
} from './schedule';

/**
 * Day rules shared by every surface that asks "is this due / done / skipped
 * today" — Home, reminders, the evening check-in, streaks, the strength score
 * and the Android widget (Kotlin, against the same SQLite rows). The widget
 * re-implements these from `__tests__/fixtures/dayRules.json`; change both.
 *
 * Storage: a skip is an event row with `value` 0 and `meta.source === 'skip'`.
 * A day is *skipped* iff it has a skip row AND is not complete. A skipped day
 * is treated exactly like a day the schedule does not offer: it neither breaks
 * nor extends a daily streak, does not move the score, and is not due.
 * Counters (with a daily target) follow the same rules on a daily schedule.
 */

export const SKIP_EVENT_SOURCE = 'skip' as const;

/** Schedule a counter's day rules run on: every day. */
export const COUNTER_DAY_RULES_SCHEDULE: HabitSchedule = { type: 'daily' };

export function isSkipEvent(event: Pick<LifeEvent, 'meta'>): boolean {
  return event.meta?.source === SKIP_EVENT_SOURCE;
}

/** The `value` and `meta` a skip row is written with. */
export function skipEventPayload(): { value: 0; meta: { source: typeof SKIP_EVENT_SOURCE } } {
  return { value: 0, meta: { source: SKIP_EVENT_SOURCE } };
}

/** One stored day: whether it met its completion rule, whether it holds a skip row. */
export interface TrackerDayFacts {
  date: string;
  complete: boolean;
  /** The day holds at least one skip row (whether or not it is also complete). */
  hasSkipRow: boolean;
}

/** A tracker's history as the day rules read it. */
export interface TrackerDayHistory {
  completed: ReadonlySet<string>;
  /** Effective skips only: a skip row on a day that is not complete. */
  skipped: ReadonlySet<string>;
}

export function trackerDayHistory(days: Iterable<TrackerDayFacts>): TrackerDayHistory {
  const completed = new Set<string>();
  const skipped = new Set<string>();
  for (const day of days) {
    if (day.complete) completed.add(day.date);
    else if (day.hasSkipRow) skipped.add(day.date);
  }
  return { completed, skipped };
}

/** Facts for one day from its events, with a completion rule over (total, events). */
export function dayFactsFromEvents(
  date: string,
  events: readonly Pick<LifeEvent, 'value' | 'meta'>[],
  isComplete: (total: number, events: readonly Pick<LifeEvent, 'value' | 'meta'>[]) => boolean,
): TrackerDayFacts {
  const total = events.reduce((sum, event) => sum + event.value, 0);
  return {
    date,
    complete: isComplete(total, events),
    hasSkipRow: events.some(isSkipEvent),
  };
}

export function isDaySkipped(history: TrackerDayHistory, date: string): boolean {
  return history.skipped.has(date) && !history.completed.has(date);
}

/**
 * The schedule offers `date` given the history, ignoring skips — what puts a row
 * on the Home list (a skipped row stays listed, sunk with the done ones).
 */
export function isOfferedOnDate(
  schedule: HabitSchedule,
  date: string,
  history: Pick<TrackerDayHistory, 'completed'>,
): boolean {
  return isScheduleDueOnDate(schedule, date, history.completed);
}

/** Due on `date`: offered by the schedule and not skipped. A complete day is still due. */
export function isDueOnDate(
  schedule: HabitSchedule,
  date: string,
  history: TrackerDayHistory,
): boolean {
  return isOfferedOnDate(schedule, date, history) && !isDaySkipped(history, date);
}

/**
 * Whether `date` counts in a *daily* streak / score walk (every schedule but
 * `times_per_week`): offered by the schedule and not skipped.
 */
export function countsAsScheduledDay(
  schedule: HabitSchedule,
  date: string,
  history: TrackerDayHistory,
): boolean {
  return isScheduleActiveOnDate(schedule, date) && !isDaySkipped(history, date);
}

export type StreakUnit = 'days' | 'weeks';

export function streakUnitForSchedule(schedule: HabitSchedule): StreakUnit {
  return schedule.type === 'times_per_week' ? 'weeks' : 'days';
}
