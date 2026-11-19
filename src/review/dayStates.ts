import {
  isDaySkipped,
  isDueOnDate,
  isOfferedOnDate,
  shiftDateString,
  weekStartDateString,
  type TrackerDayHistory,
} from '../protocol';
import { dayRulesSchedule, type DayRulesTracker } from '../utils/trackerDayRules';

/**
 * One cell of a Review strip:
 * - `done`: the day met its completion rule;
 * - `skipped`: skipped and not complete;
 * - `open`: today, due, neither done nor skipped — never a miss;
 * - `missed`: a past due day that is neither done nor skipped;
 * - `none`: before the tracker existed, after today, or not scheduled.
 */
export type ReviewDayState = 'done' | 'missed' | 'skipped' | 'open' | 'none';

export interface ReviewDay {
  date: string;
  state: ReviewDayState;
}

/** A tracker as Review reads it. */
export interface ReviewTracker {
  id: string;
  rules: DayRulesTracker;
  /** Local calendar day it was created; null when unknown (counts as always existing). */
  createdOn: string | null;
}

/** A tracker with its day history (`trackerDayHistory`) — what `loadReviewData` returns. */
export interface ReviewTrackerData {
  tracker: ReviewTracker;
  history: TrackerDayHistory;
}

/** Whether a tracker can miss a day: habits, and counters with a daily target. */
export function isMissable(rules: DayRulesTracker): boolean {
  if (rules.kind === 'habit') return true;
  const target = rules.config.dailyTarget;
  return target !== undefined && target > 0;
}

/**
 * The day states of one tracker for `dates` (local `YYYY-MM-DD`, any order),
 * from its day history (`trackerDayHistory`). Due, done and skipped come from
 * the day rules in `src/protocol/dayRules.ts`.
 *
 * `times_per_week`: done days are `done`, skips `skipped`, today `open` while
 * the week still needs it. A finished week short by k marks its k latest days
 * that are neither done nor skipped as `missed`. The current week never misses,
 * and neither does the creation week (it was not a full week — as for the
 * weekly failure streak). Everything else is `none`.
 */
export function reviewDayStates(
  tracker: ReviewTracker,
  history: TrackerDayHistory,
  dates: readonly string[],
  today: string,
): ReviewDay[] {
  const stateOf = dayStateReader(tracker, history, today);
  return dates.map((date) => ({ date, state: stateOf(date) }));
}

function dayStateReader(
  tracker: ReviewTracker,
  history: TrackerDayHistory,
  today: string,
): (date: string) => ReviewDayState {
  const { rules, createdOn } = tracker;
  const exists = (date: string) => date <= today && !(createdOn && date < createdOn);

  if (!isMissable(rules)) {
    return (date) => (exists(date) && history.completed.has(date) ? 'done' : 'none');
  }

  const schedule = dayRulesSchedule(rules);
  if (schedule.type !== 'times_per_week') {
    return (date) => {
      if (!exists(date) || !isOfferedOnDate(schedule, date, history)) return 'none';
      if (history.completed.has(date)) return 'done';
      if (isDaySkipped(history, date)) return 'skipped';
      return date === today ? 'open' : 'missed';
    };
  }

  const missedByWeek = new Map<string, ReadonlySet<string>>();
  const weekMisses = (weekStart: string): ReadonlySet<string> => {
    let misses = missedByWeek.get(weekStart);
    if (!misses) {
      misses = finishedWeekMisses(weekStart, schedule.times, history, today, createdOn);
      missedByWeek.set(weekStart, misses);
    }
    return misses;
  };

  return (date) => {
    if (!exists(date)) return 'none';
    if (history.completed.has(date)) return 'done';
    if (isDaySkipped(history, date)) return 'skipped';
    if (date === today) return isDueOnDate(schedule, date, history) ? 'open' : 'none';
    return weekMisses(weekStartDateString(date)).has(date) ? 'missed' : 'none';
  };
}

/** The days a finished, full Monday–Sunday week marks missed (latest first). */
function finishedWeekMisses(
  weekStart: string,
  times: number,
  history: TrackerDayHistory,
  today: string,
  createdOn: string | null,
): ReadonlySet<string> {
  const misses = new Set<string>();
  const weekEnd = shiftDateString(weekStart, 6);
  if (weekEnd >= today || (createdOn && weekStart < createdOn)) return misses;

  const days: string[] = [];
  for (let date = weekStart; date <= weekEnd; date = shiftDateString(date, 1)) days.push(date);
  let short = times - days.filter((date) => history.completed.has(date)).length;
  for (const date of days.reverse()) {
    if (short <= 0) break;
    if (history.completed.has(date) || isDaySkipped(history, date)) continue;
    misses.add(date);
    short--;
  }
  return misses;
}
