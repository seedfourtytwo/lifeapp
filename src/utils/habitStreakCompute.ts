import type { HabitConfig, HabitSchedule, LifeEvent, StreakUnit, TrackerDayFacts } from '../protocol';
import {
  countsAsScheduledDay,
  dayFactsFromEvents,
  isHabitDayComplete,
  streakUnitForSchedule,
  toDateString,
  trackerDayHistory,
  weekStartDateString,
  type TrackerDayHistory,
} from '../protocol';
import {
  computeFailureStreakRun,
  computeStreakRun,
  computeWeeklyFailureStreakRun,
  computeWeeklyStreakRun,
} from './streak';
import { computeStrengthScore } from './strengthScore';

export interface HabitStreaks {
  /** Success run, in `streakUnit`s. */
  streak: number;
  /** Missed run, in `streakUnit`s. */
  failureStreak: number;
  /** `weeks` for `times_per_week`, else `days`. */
  streakUnit: StreakUnit;
  /** Strength score 0–100 (see `strengthScore.ts`). */
  score: number;
  /** A run was still unbroken at `windowStart`: older data could lengthen it. */
  truncated?: boolean;
}

/** A day's SUM, plus whether it holds a skip row (value 0, so SUM cannot show it). */
export interface DailyTotalRow {
  date: string;
  total: number;
  skipped?: boolean;
}

/**
 * Streaks and score for any tracker on `schedule` (counters pass a daily one),
 * from its day history. Pure — the Kotlin widget implements the same walk.
 */
export function computeTrackerStreaks(
  schedule: HabitSchedule,
  history: TrackerDayHistory,
  today: string,
  createdOn?: string | null,
  windowStart?: string | null,
): HabitStreaks {
  const score = computeStrengthScore({ schedule, history, today, createdOn });
  const streakUnit = streakUnitForSchedule(schedule);
  if (schedule.type === 'times_per_week') {
    const input = {
      completedDates: history.completed,
      today,
      times: schedule.times,
      weekStartOf: weekStartDateString,
      createdOn,
      windowStart,
    };
    const success = computeWeeklyStreakRun(input);
    const failure = computeWeeklyFailureStreakRun(input);
    return {
      streak: success.count,
      failureStreak: failure.count,
      streakUnit,
      score,
      truncated: success.truncated || failure.truncated,
    };
  }

  const isScheduled = (date: string) => countsAsScheduledDay(schedule, date, history);
  const inf = Number.POSITIVE_INFINITY;
  const success = computeStreakRun(history.completed, today, isScheduled, inf, createdOn, windowStart);
  const failure = computeFailureStreakRun(
    history.completed,
    today,
    isScheduled,
    inf,
    createdOn,
    windowStart,
  );
  return {
    streak: success.count,
    failureStreak: failure.count,
    streakUnit,
    score,
    truncated: success.truncated || failure.truncated,
  };
}

/** Day history of a habit from its events (meta-aware completion, skip rows). */
export function habitDayHistoryFromEvents(
  events: readonly LifeEvent[],
  config: HabitConfig,
): TrackerDayHistory {
  const byDate = new Map<string, LifeEvent[]>();
  for (const event of events) {
    const day = byDate.get(event.date) ?? [];
    day.push(event);
    byDate.set(event.date, day);
  }
  const facts: TrackerDayFacts[] = [];
  for (const [date, dayEvents] of byDate) {
    facts.push(
      dayFactsFromEvents(date, dayEvents, (total, evs) => isHabitDayComplete(total, config, evs)),
    );
  }
  return trackerDayHistory(facts);
}

/** Day history from daily totals, with a completion rule over the total. */
export function dayHistoryFromDailyTotals(
  dailyTotals: readonly DailyTotalRow[],
  isComplete: (total: number) => boolean,
): TrackerDayHistory {
  return trackerDayHistory(
    dailyTotals.map((row) => ({
      date: row.date,
      complete: isComplete(row.total),
      hasSkipRow: row.skipped === true,
    })),
  );
}

/** Derive success and failure streaks from preloaded habit events. */
export function computeHabitStreaksFromEvents(
  events: readonly LifeEvent[],
  config: HabitConfig,
  today = toDateString(new Date()),
  createdOn?: string | null,
  windowStart?: string | null,
): HabitStreaks {
  return computeTrackerStreaks(
    config.schedule,
    habitDayHistoryFromEvents(events, config),
    today,
    createdOn,
    windowStart,
  );
}

/** Derive streaks from daily SUM totals (no per-event meta beyond the skip flag). */
export function computeHabitStreaksFromDailyTotals(
  dailyTotals: readonly DailyTotalRow[],
  config: HabitConfig,
  today = toDateString(new Date()),
  createdOn?: string | null,
  windowStart?: string | null,
): HabitStreaks {
  return computeTrackerStreaks(
    config.schedule,
    dayHistoryFromDailyTotals(dailyTotals, (total) => isHabitDayComplete(total, config)),
    today,
    createdOn,
    windowStart,
  );
}
