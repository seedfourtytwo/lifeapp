import { toDateString } from '../protocol';

function dateFromString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function previousDateString(dateStr: string): string {
  const d = dateFromString(dateStr);
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

/**
 * Consecutive scheduled days completed, ending today (if done) or yesterday.
 */
export function computeStreak(
  completedDates: Iterable<string>,
  today: string,
  isScheduledOnDate: (date: string) => boolean = () => true,
  maxLookback = 365,
): number {
  const completed = new Set(completedDates);
  let cursor = today;

  if (!completed.has(today)) {
    cursor = previousDateString(today);
  }

  let streak = 0;
  for (let i = 0; i < maxLookback; i++) {
    if (!isScheduledOnDate(cursor)) {
      cursor = previousDateString(cursor);
      continue;
    }
    if (completed.has(cursor)) {
      streak++;
      cursor = previousDateString(cursor);
    } else {
      break;
    }
  }

  return streak;
}

export function completedDatesFromDailyTotals(
  rows: { date: string; total: number }[],
  isComplete: (total: number) => boolean,
): string[] {
  return rows.filter((row) => isComplete(row.total)).map((row) => row.date);
}
