import {
  dayOutcome,
  isHabitScheduledOnDate,
  toDateString,
  type DayFacts,
  type DayOutcomeTracker,
} from '../protocol';
import { computeFailureStreak, computeStreak } from './streak';

export interface DatedDayFacts {
  date: string;
  facts: DayFacts;
}

/** The days `dayOutcome` calls done, in the order given. */
export function completedDates(
  tracker: DayOutcomeTracker,
  days: readonly DatedDayFacts[],
): string[] {
  return days.filter(({ facts }) => dayOutcome(tracker, facts).done).map(({ date }) => date);
}

/**
 * Current success and failure streaks, ending today (if done) or yesterday.
 * Habits skip days they are not scheduled on; counters count every day.
 */
export function computeTrackerStreaks(
  tracker: DayOutcomeTracker,
  days: readonly DatedDayFacts[],
  today = toDateString(new Date()),
  createdOn?: string | null,
): { streak: number; failureStreak: number } {
  const completed = completedDates(tracker, days);
  const isScheduled =
    tracker.kind === 'habit'
      ? (date: string) => isHabitScheduledOnDate(tracker.config, date)
      : () => true;
  return {
    streak: computeStreak(completed, today, isScheduled, 365, createdOn),
    failureStreak: computeFailureStreak(completed, today, isScheduled, 365, createdOn),
  };
}
