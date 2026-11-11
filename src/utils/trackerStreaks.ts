import {
  dayOutcome,
  factsFromTotal,
  isHabitScheduledOnDate,
  shiftDateString,
  toDateString,
  type DayFacts,
  type DayOutcomeTracker,
} from '../protocol';
import { computeFailureStreak, computeStreak } from './streak';

export interface DatedDayFacts {
  date: string;
  facts: DayFacts;
}

/** Habits keep their schedule; counters and commitments run every day. */
export function isTrackerScheduledOn(tracker: DayOutcomeTracker, date: string): boolean {
  switch (tracker.kind) {
    case 'habit':
      return isHabitScheduledOnDate(tracker.config, date);
    case 'counter':
    case 'commitment':
      return true;
    default: {
      const unknown: never = tracker;
      throw new Error(`Unknown tracker kind ${JSON.stringify(unknown)}`);
    }
  }
}

const LOOKBACK_DAYS = 365;

/**
 * Every done day in the streak window, newest first, a day with nothing
 * logged included: a commitment's day with no slip is kept although it has
 * no row at all. Days before `createdOn` are not counted.
 */
export function completedDays(
  tracker: DayOutcomeTracker,
  days: readonly DatedDayFacts[],
  today: string,
  createdOn: string | null | undefined,
): string[] {
  const byDate = new Map(days.map(({ date, facts }) => [date, facts]));
  const completed: string[] = [];
  for (let back = 0; back <= LOOKBACK_DAYS; back += 1) {
    const date = shiftDateString(today, -back);
    if (createdOn && date < createdOn) break;
    if (dayOutcome(tracker, byDate.get(date) ?? factsFromTotal(0)).done) completed.push(date);
  }
  return completed;
}

/**
 * Current success and failure streaks, ending today (if done) or yesterday.
 * Habits skip days they are not scheduled on; counters and commitments count every day.
 */
export function computeTrackerStreaks(
  tracker: DayOutcomeTracker,
  days: readonly DatedDayFacts[],
  today = toDateString(new Date()),
  createdOn?: string | null,
): { streak: number; failureStreak: number } {
  const completed = completedDays(tracker, days, today, createdOn);
  const isScheduled = (date: string) => isTrackerScheduledOn(tracker, date);
  return {
    streak: computeStreak(completed, today, isScheduled, LOOKBACK_DAYS, createdOn),
    failureStreak: computeFailureStreak(completed, today, isScheduled, LOOKBACK_DAYS, createdOn),
  };
}
