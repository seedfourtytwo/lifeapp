import { COUNTER_DAY_RULES_SCHEDULE, toDateString } from '../protocol';
import type { StreakRun } from './streak';
import {
  computeTrackerStreaks,
  dayHistoryFromDailyTotals,
  type DailyTotalRow,
  type HabitStreaks,
} from './habitStreakCompute';

/** Calendar days where the counter's daily total met or exceeded the target. */
export function completedDatesFromCounterDailyTotals(
  dailyTotals: readonly { date: string; total: number }[],
  dailyTarget: number,
): string[] {
  if (dailyTarget <= 0) return [];
  const completed: string[] = [];
  for (const { date, total } of dailyTotals) {
    if (total >= dailyTarget) completed.push(date);
  }
  return completed;
}

/**
 * Streaks and strength score for a counter with a daily target: the day rules
 * of a daily habit, where complete means total ≥ target and a skipped day is
 * free. Without a target a counter has no streak and no score.
 */
export function computeCounterStreaks(
  dailyTotals: readonly DailyTotalRow[],
  dailyTarget: number,
  today = toDateString(new Date()),
  createdOn?: string | null,
  windowStart?: string | null,
): HabitStreaks {
  if (dailyTarget <= 0) {
    return { streak: 0, failureStreak: 0, streakUnit: 'days', score: 0, truncated: false };
  }
  return computeTrackerStreaks(
    COUNTER_DAY_RULES_SCHEDULE,
    dayHistoryFromDailyTotals(dailyTotals, (total) => total >= dailyTarget),
    today,
    createdOn,
    windowStart,
  );
}

/** Counter streak plus whether it was still unbroken at `windowStart`. */
export function computeCounterTargetStreakRun(
  dailyTotals: readonly DailyTotalRow[],
  dailyTarget: number,
  today = toDateString(new Date()),
  createdOn?: string | null,
  windowStart?: string | null,
): StreakRun {
  const result = computeCounterStreaks(dailyTotals, dailyTarget, today, createdOn, windowStart);
  return { count: result.streak, truncated: result.truncated === true };
}

/** Consecutive days hitting the daily target, ending today (if hit) or yesterday. */
export function computeCounterTargetStreak(
  dailyTotals: readonly DailyTotalRow[],
  dailyTarget: number,
  today = toDateString(new Date()),
  createdOn?: string | null,
): number {
  return computeCounterTargetStreakRun(dailyTotals, dailyTarget, today, createdOn).count;
}
