import type { HabitConfig, LifeEvent } from '../protocol';
import {
  completedDatesFromDailyTotals,
  completedDatesFromHabitEvents,
  habitNeedsEventMetaForCompletion,
  isHabitScheduledOnDate,
  toDateString,
} from '../protocol';
import { computeFailureStreak, computeStreak } from './streak';

function streaksFromCompleted(
  completed: string[],
  config: HabitConfig,
  today: string,
): { streak: number; failureStreak: number } {
  const isScheduled = (date: string) => isHabitScheduledOnDate(config, date);
  return {
    streak: computeStreak(completed, today, isScheduled),
    failureStreak: computeFailureStreak(completed, today, isScheduled),
  };
}

/** Derive success and failure streaks from a preloaded year of habit events. */
export function computeHabitStreaksFromEvents(
  events: readonly LifeEvent[],
  config: HabitConfig,
  today = toDateString(new Date()),
): { streak: number; failureStreak: number } {
  return streaksFromCompleted(completedDatesFromHabitEvents(events, config), config, today);
}

/** Derive streaks from daily SUM totals (no per-event meta). */
export function computeHabitStreaksFromDailyTotals(
  dailyTotals: readonly { date: string; total: number }[],
  config: HabitConfig,
  today = toDateString(new Date()),
): { streak: number; failureStreak: number } {
  return streaksFromCompleted(completedDatesFromDailyTotals(dailyTotals, config), config, today);
}
