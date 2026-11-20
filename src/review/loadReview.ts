import type { SQLiteDatabase } from 'expo-sqlite';
import { getDayFactsForElementsSince, type DayFactsRow } from '../db/repositories/eventRepository';
import {
  CounterConfigSchema,
  isElementDayComplete,
  isHabitDayComplete,
  parseHabitConfig,
  shiftDateString,
  trackerDayHistory,
  weekStartDateString,
  type ElementDefinition,
  type LifeEvent,
} from '../protocol';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { STRENGTH_LOOKBACK_DAYS } from '../utils/strengthScore';
import type { DayRulesTracker } from '../utils/trackerDayRules';
import type { ReviewTrackerData } from './dayStates';

/**
 * Stands in for a day's rows when the aggregate saw a finished play-once track,
 * so `isHabitDayComplete` — not a copy of it — decides what that means.
 */
const FINISHED_TRACK_ROWS: readonly Pick<LifeEvent, 'value' | 'meta'>[] = [
  { value: 0, meta: { source: 'timer_session', trackCompleted: true } },
];

function rulesOf(element: ElementDefinition): DayRulesTracker {
  return element.kind === 'habit'
    ? { kind: 'habit', config: parseHabitConfig(element.config) }
    : { kind: 'counter', config: CounterConfigSchema.parse(element.config) };
}

/** A day's completion: the habit rule (meta-aware), or the counter rule (target, else anything logged). */
function completionRule(element: ElementDefinition, rules: DayRulesTracker): (day: DayFactsRow) => boolean {
  if (rules.kind === 'habit') {
    return (day) => isHabitDayComplete(day.total, rules.config, day.trackCompleted ? FINISHED_TRACK_ROWS : []);
  }
  return (day) => isElementDayComplete(element, day.total);
}

/**
 * Every tracker's day history for Review, in `elements` order, from ONE
 * aggregate read. Loads `days` days ending `today` — at least the strength
 * score's lookback — back to that first day's Monday, so a `times_per_week`
 * week at the edge is whole. For `reviewSummary` pass twice the range length.
 */
export async function loadReviewData(
  db: SQLiteDatabase,
  input: { elements: readonly ElementDefinition[]; days: number; today: string },
): Promise<ReviewTrackerData[]> {
  const { elements, today } = input;
  if (elements.length === 0) return [];
  const span = Math.max(input.days, STRENGTH_LOOKBACK_DAYS);
  const since = weekStartDateString(shiftDateString(today, -(span - 1)));
  const factsById = await getDayFactsForElementsSince(
    db,
    elements.map((element) => element.id),
    since,
  );

  return elements.map((element) => {
    const rules = rulesOf(element);
    const isComplete = completionRule(element, rules);
    const days = factsById.get(element.id) ?? [];
    return {
      tracker: { id: element.id, rules, createdOn: createdOnLocalDate(element.createdAt) },
      history: trackerDayHistory(
        days.map((day) => ({ date: day.date, complete: isComplete(day), hasSkipRow: day.skipped })),
      ),
    };
  });
}
