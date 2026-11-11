import type { SQLiteDatabase } from 'expo-sqlite';
import {
  factsFromTotal,
  dayOutcome,
  toDateString,
  type DayFacts,
  type ElementDefinition,
} from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import { computePersonalBestStreak } from '../utils/chartStats';
import { streakHistorySinceDate } from '../utils/dates';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { completedDays, computeTrackerStreaks, isTrackerScheduledOn } from '../utils/trackerStreaks';

export interface TrackerHistoryDay {
  date: string;
  facts: DayFacts;
  /** False before the tracker existed: such a day counts neither way. */
  counted: boolean;
  done: boolean;
}

export interface TrackerHistory {
  days: TrackerHistoryDay[];
  /** Habits and the commitment; a counter's History shows no streak. */
  streak: number;
  personalBest: number;
}

/**
 * One tracker's days for the History screen, plus its streaks. The chart, the
 * "days done" count and the streak all come from the same day facts and the
 * same rule, so they cannot disagree about a day.
 */
export async function loadTrackerHistory(
  db: SQLiteDatabase,
  element: ElementDefinition,
  dates: readonly string[],
): Promise<TrackerHistory> {
  const tracker = element;
  const createdOn = createdOnLocalDate(element.createdAt);
  const streakSince = streakHistorySinceDate();
  const first = dates[0] ?? streakSince;
  const since = first < streakSince ? first : streakSince;
  const logged =
    (await eventRepo.getDayFactsForElementsSince(db, [element.id], since)).get(element.id) ?? [];
  const byDate = new Map(logged.map(({ date, facts }) => [date, facts]));

  const days = dates.map((date) => {
    const facts = byDate.get(date) ?? factsFromTotal(0);
    const counted = createdOn === null || date >= createdOn;
    return { date, facts, counted, done: counted && dayOutcome(tracker, facts).done };
  });
  if (tracker.kind === 'counter') return { days, streak: 0, personalBest: 0 };

  const history = logged.filter(({ date }) => date >= streakSince);
  const today = toDateString(new Date());
  const { streak } = computeTrackerStreaks(tracker, history, today, createdOn);
  const personalBest = computePersonalBestStreak(
    completedDays(tracker, history, today, createdOn),
    (date) => isTrackerScheduledOn(tracker, date),
  );
  return { days, streak, personalBest };
}
