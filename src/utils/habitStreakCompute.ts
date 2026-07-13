import {
  completedDatesFromHabitEvents,
  isHabitScheduledOnDate,
  toDateString,
  type HabitConfig,
  type LifeEvent,
} from '../protocol';
import { computeFailureStreak, computeStreak } from './streak';

/** Derive success and failure streaks from a preloaded year of habit events. */
export function computeHabitStreaksFromEvents(
  events: readonly LifeEvent[],
  config: HabitConfig,
  today = toDateString(new Date()),
): { streak: number; failureStreak: number } {
  const completed = completedDatesFromHabitEvents(events, config);
  const isScheduled = (date: string) => isHabitScheduledOnDate(config, date);
  return {
    streak: computeStreak(completed, today, isScheduled),
    failureStreak: computeFailureStreak(completed, today, isScheduled),
  };
}
