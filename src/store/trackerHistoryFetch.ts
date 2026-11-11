import type { SQLiteDatabase } from 'expo-sqlite';
import {
  factsFromTotal,
  dayOutcome,
  isHabitScheduledOnDate,
  type DayFacts,
  type ElementDefinition,
} from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import { computePersonalBestStreak } from '../utils/chartStats';
import { streakHistorySinceDate } from '../utils/dates';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { completedDates, computeTrackerStreaks } from '../utils/trackerStreaks';

export interface TrackerHistoryDay {
  date: string;
  facts: DayFacts;
  done: boolean;
}

export interface TrackerHistory {
  days: TrackerHistoryDay[];
  /** Habits only; a counter's History shows no streak. */
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
  const streakSince = streakHistorySinceDate();
  const first = dates[0] ?? streakSince;
  const since = first < streakSince ? first : streakSince;
  const logged =
    (await eventRepo.getDayFactsForElementsSince(db, [element.id], since)).get(element.id) ?? [];
  const byDate = new Map(logged.map(({ date, facts }) => [date, facts]));

  const days = dates.map((date) => {
    const facts = byDate.get(date) ?? factsFromTotal(0);
    return { date, facts, done: dayOutcome(tracker, facts).done };
  });
  if (tracker.kind !== 'habit') return { days, streak: 0, personalBest: 0 };

  const history = logged.filter(({ date }) => date >= streakSince);
  const { streak } = computeTrackerStreaks(
    tracker,
    history,
    undefined,
    createdOnLocalDate(element.createdAt),
  );
  const personalBest = computePersonalBestStreak(completedDates(tracker, history), (date) =>
    isHabitScheduledOnDate(tracker.config, date),
  );
  return { days, streak, personalBest };
}
