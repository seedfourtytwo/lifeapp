import {
  dayOutcome,
  factsFromTotal,
  shiftDateString,
  type DayFacts,
  type DayOutcomeTracker,
} from '../protocol';
import { isTrackerScheduledOn } from './trackerStreaks';

/**
 * One day of a short strip. `not_done` on today means "not yet"; on a
 * commitment it means the day held a slip. `not_counted` is a day before the
 * tracker existed, which counts neither way.
 */
export type StripDayState = 'done' | 'not_done' | 'not_due' | 'not_counted';

export interface StripDay {
  date: string;
  state: StripDayState;
}

/** The last `length` days ending `today`, oldest first, each judged by `dayOutcome`. */
export function dayStrip(
  tracker: DayOutcomeTracker,
  factsByDate: ReadonlyMap<string, DayFacts>,
  today: string,
  createdOn: string | null,
  length: number,
): StripDay[] {
  return Array.from({ length }, (_, index) => {
    const date = shiftDateString(today, index - length + 1);
    if (createdOn !== null && date < createdOn) return { date, state: 'not_counted' };
    if (!isTrackerScheduledOn(tracker, date)) return { date, state: 'not_due' };
    const { done } = dayOutcome(tracker, factsByDate.get(date) ?? factsFromTotal(0));
    return { date, state: done ? 'done' : 'not_done' };
  });
}
