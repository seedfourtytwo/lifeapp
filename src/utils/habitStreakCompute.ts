import type { HabitConfig, LifeEvent } from '../protocol';
import {
  completedDatesFromDailyTotals,
  completedDatesFromHabitEvents,
  isHabitScheduledOnDate,
  toDateString,
} from '../protocol';
import { computeFailureStreakRun, computeStreakRun } from './streak';

export interface HabitStreaks {
  streak: number;
  failureStreak: number;
  /** A run was still unbroken at `windowStart`: older data could lengthen it. */
  truncated?: boolean;
}

function streaksFromCompleted(
  completed: string[],
  config: HabitConfig,
  today: string,
  createdOn?: string | null,
  windowStart?: string | null,
): HabitStreaks {
  const isScheduled = (date: string) => isHabitScheduledOnDate(config, date);
  const inf = Number.POSITIVE_INFINITY;
  const success = computeStreakRun(completed, today, isScheduled, inf, createdOn, windowStart);
  const failure = computeFailureStreakRun(completed, today, isScheduled, inf, createdOn, windowStart);
  return {
    streak: success.count,
    failureStreak: failure.count,
    truncated: success.truncated || failure.truncated,
  };
}

/** Derive success and failure streaks from preloaded habit events. */
export function computeHabitStreaksFromEvents(
  events: readonly LifeEvent[],
  config: HabitConfig,
  today = toDateString(new Date()),
  createdOn?: string | null,
  windowStart?: string | null,
): HabitStreaks {
  return streaksFromCompleted(
    completedDatesFromHabitEvents(events, config),
    config,
    today,
    createdOn,
    windowStart,
  );
}

/** Derive streaks from daily SUM totals (no per-event meta). */
export function computeHabitStreaksFromDailyTotals(
  dailyTotals: readonly { date: string; total: number }[],
  config: HabitConfig,
  today = toDateString(new Date()),
  createdOn?: string | null,
  windowStart?: string | null,
): HabitStreaks {
  return streaksFromCompleted(
    completedDatesFromDailyTotals(dailyTotals, config),
    config,
    today,
    createdOn,
    windowStart,
  );
}
