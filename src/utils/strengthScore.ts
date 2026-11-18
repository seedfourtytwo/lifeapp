import {
  countsAsScheduledDay,
  isDaySkipped,
  shiftDateString,
  type HabitSchedule,
  type TrackerDayHistory,
} from '../protocol';

/**
 * Strength score (0–100): rises when the habit is done, fades slowly when it is
 * not — Loop Habit Tracker's exponential smoothing:
 *
 *   multiplier = 0.5 ^ (sqrt(frequency) / 13)
 *   score      = score * multiplier + value * (1 - multiplier)
 *
 * Contract with the Android widget (`__tests__/fixtures/dayRules.json`):
 * - Walk day by day from max(createdOn, today − 399) through today, from 0.
 *   Days with no stored row are simply "not complete".
 * - daily / weekdays / every_n_days (and counters with a target): frequency 1.
 *   A day the schedule offers and that is not skipped updates with value
 *   1 (complete) or 0; an unoffered or skipped day carries the score over.
 * - times_per_week: frequency times / 7. Every day updates with value 1 when
 *   the trailing 7 days ending that day (inclusive) hold ≥ times completed
 *   days, else 0; a skipped day carries over.
 * - Today never lowers the score: if today does not yet earn value 1, it is
 *   left out rather than counted as 0.
 * - Completed days before createdOn do not count (they do not exist).
 * - Output: Math.round(score * 100), i.e. floor(x + 0.5) — not banker's rounding.
 */

/** Days walked, today included. Older days contribute nothing measurable. */
export const STRENGTH_LOOKBACK_DAYS = 400;

export function strengthMultiplier(frequency: number): number {
  return Math.pow(0.5, Math.sqrt(frequency) / 13);
}

export function computeStrengthScore(input: {
  schedule: HabitSchedule;
  history: TrackerDayHistory;
  today: string;
  createdOn?: string | null;
}): number {
  const { schedule, history, today, createdOn } = input;
  const lookbackStart = shiftDateString(today, -(STRENGTH_LOOKBACK_DAYS - 1));
  const start = createdOn && createdOn > lookbackStart ? createdOn : lookbackStart;
  if (start > today) return 0;

  const isCompleted = (date: string) =>
    history.completed.has(date) && !(createdOn && date < createdOn);

  const weekly = schedule.type === 'times_per_week';
  const multiplier = strengthMultiplier(weekly ? schedule.times / 7 : 1);
  let score = 0;

  // Trailing-7-day count for times_per_week, kept as a sliding window.
  let trailing = 0;
  if (weekly) {
    for (let offset = 6; offset >= 1; offset--) {
      if (isCompleted(shiftDateString(start, -offset))) trailing++;
    }
  }

  for (let date = start; date <= today; date = shiftDateString(date, 1)) {
    let value: number | null;
    if (weekly) {
      if (isCompleted(date)) trailing++;
      if (date > start && isCompleted(shiftDateString(date, -7))) trailing--;
      value = isDaySkipped(history, date) ? null : trailing >= schedule.times ? 1 : 0;
    } else {
      value = countsAsScheduledDay(schedule, date, history)
        ? isCompleted(date)
          ? 1
          : 0
        : null;
    }
    if (value === null) continue;
    if (date === today && value === 0) continue;
    score = score * multiplier + value * (1 - multiplier);
  }

  return Math.round(score * 100);
}
