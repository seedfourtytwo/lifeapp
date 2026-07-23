import { toDateString } from '../protocol';
import { computeStreak } from './streak';

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

/** Consecutive days hitting the daily target, ending today (if hit) or yesterday. */
export function computeCounterTargetStreak(
  dailyTotals: readonly { date: string; total: number }[],
  dailyTarget: number,
  today = toDateString(new Date()),
  createdOn?: string | null,
): number {
  if (dailyTarget <= 0) return 0;
  return computeStreak(
    completedDatesFromCounterDailyTotals(dailyTotals, dailyTarget),
    today,
    () => true,
    365,
    createdOn,
  );
}
