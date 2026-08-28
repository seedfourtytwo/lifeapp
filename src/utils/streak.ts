import { shiftDateString } from '../protocol';

function previousDateString(dateStr: string): string {
  return shiftDateString(dateStr, -1);
}

/**
 * Consecutive scheduled days completed, ending today (if done) or yesterday.
 * When `createdOn` is set, days before that date are ignored (new habits don't inherit year of misses).
 */
export function computeStreak(
  completedDates: Iterable<string>,
  today: string,
  isScheduledOnDate: (date: string) => boolean = () => true,
  maxLookback = 365,
  createdOn?: string | null,
): number {
  const completed = new Set(completedDates);
  let cursor = today;

  if (!completed.has(today)) {
    cursor = previousDateString(today);
  }

  let streak = 0;
  for (let i = 0; i < maxLookback; i++) {
    if (createdOn && cursor < createdOn) break;
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

/**
 * Consecutive scheduled days missed, ending yesterday when today is still open.
 * Returns 0 when today is complete (no active failure streak).
 * When `createdOn` is set, days before that date are ignored.
 */
export function computeFailureStreak(
  completedDates: Iterable<string>,
  today: string,
  isScheduledOnDate: (date: string) => boolean = () => true,
  maxLookback = 365,
  createdOn?: string | null,
): number {
  const completed = new Set(completedDates);
  if (completed.has(today)) {
    return 0;
  }

  let cursor = previousDateString(today);
  let failureStreak = 0;

  for (let i = 0; i < maxLookback; i++) {
    if (createdOn && cursor < createdOn) break;
    if (!isScheduledOnDate(cursor)) {
      cursor = previousDateString(cursor);
      continue;
    }
    if (!completed.has(cursor)) {
      failureStreak++;
      cursor = previousDateString(cursor);
    } else {
      break;
    }
  }

  return failureStreak;
}
