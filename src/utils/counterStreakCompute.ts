import { toDateString } from '../protocol';
import { computeStreakRun, type StreakRun } from './streak';

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

/** Counter streak plus whether it was still unbroken at `windowStart`. */
export function computeCounterTargetStreakRun(
  dailyTotals: readonly { date: string; total: number }[],
  dailyTarget: number,
  today = toDateString(new Date()),
  createdOn?: string | null,
  windowStart?: string | null,
): StreakRun {
  if (dailyTarget <= 0) return { count: 0, truncated: false };
  return computeStreakRun(
    completedDatesFromCounterDailyTotals(dailyTotals, dailyTarget),
    today,
    () => true,
    Number.POSITIVE_INFINITY,
    createdOn,
    windowStart,
  );
}

/** Consecutive days hitting the daily target, ending today (if hit) or yesterday. */
export function computeCounterTargetStreak(
  dailyTotals: readonly { date: string; total: number }[],
  dailyTarget: number,
  today = toDateString(new Date()),
  createdOn?: string | null,
): number {
  return computeCounterTargetStreakRun(dailyTotals, dailyTarget, today, createdOn).count;
}
