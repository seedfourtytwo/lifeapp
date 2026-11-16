import {
  COUNTER_DAY_RULES_SCHEDULE,
  isDaySkipped,
  isDueOnDate,
  isHabitDayComplete,
  type CounterConfig,
  type HabitConfig,
  type HabitSchedule,
  type StreakUnit,
} from '../protocol';
import {
  computeTrackerStreaks,
  dayHistoryFromDailyTotals,
  type DailyTotalRow,
} from './habitStreakCompute';

/** A tracker as the day rules see it. */
export type DayRulesTracker =
  | { kind: 'habit'; config: HabitConfig }
  | { kind: 'counter'; config: CounterConfig };

/** Everything the Home row, reminders and the widget need to know about today. */
export interface TrackerTodayState {
  dueToday: boolean;
  doneToday: boolean;
  skippedToday: boolean;
  streak: number;
  failureStreak: number;
  streakUnit: StreakUnit;
  /** 0–100; always 0 for a counter without a daily target. */
  score: number;
}

export function dayRulesSchedule(tracker: DayRulesTracker): HabitSchedule {
  return tracker.kind === 'habit' ? tracker.config.schedule : COUNTER_DAY_RULES_SCHEDULE;
}

/**
 * A day's completion from its SUM alone. Exact for every tracker except a
 * play-once timer habit without a seconds target, whose completion lives in
 * event meta (`trackCompleted`) — those go through the events path instead.
 */
export function isTrackerTotalComplete(tracker: DayRulesTracker, total: number): boolean {
  if (tracker.kind === 'habit') return isHabitDayComplete(total, tracker.config);
  const target = tracker.config.dailyTarget;
  return target !== undefined && target > 0 && total >= target;
}

/**
 * The whole day-rules contract in one call, from daily totals. This is what
 * `__tests__/fixtures/dayRules.json` exercises and what the Kotlin widget mirrors.
 */
export function evaluateTrackerToday(input: {
  tracker: DayRulesTracker;
  days: readonly DailyTotalRow[];
  today: string;
  createdOn?: string | null;
}): TrackerTodayState {
  const { tracker, days, today, createdOn } = input;
  const schedule = dayRulesSchedule(tracker);
  const history = dayHistoryFromDailyTotals(days, (total) => isTrackerTotalComplete(tracker, total));
  const hasTarget =
    tracker.kind === 'habit' ||
    (tracker.config.dailyTarget !== undefined && tracker.config.dailyTarget > 0);
  const streaks = hasTarget
    ? computeTrackerStreaks(schedule, history, today, createdOn)
    : { streak: 0, failureStreak: 0, streakUnit: 'days' as const, score: 0 };
  return {
    dueToday: isDueOnDate(schedule, today, history),
    doneToday: history.completed.has(today),
    skippedToday: isDaySkipped(history, today),
    streak: streaks.streak,
    failureStreak: streaks.failureStreak,
    streakUnit: streaks.streakUnit,
    score: streaks.score,
  };
}
