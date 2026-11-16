import type { SQLiteDatabase } from 'expo-sqlite';
import {
  habitNeedsEventMetaForCompletion,
  type HabitConfig,
  type LifeEvent,
} from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { getDatabase } from '../db/client';
import { MAX_WINDOW_EXTENSIONS, streakWindowSinceDate } from '../utils/dates';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import {
  computeHabitStreaksFromDailyTotals,
  computeHabitStreaksFromEvents,
} from '../utils/habitStreakCompute';

export interface HabitStreakInput {
  id: string;
  config: HabitConfig;
  /** ISO datetime or YYYY-MM-DD — streaks ignore days before this. */
  createdAt?: string | null;
}

function createdOnDate(createdAt?: string | null): string | null {
  return createdOnLocalDate(createdAt);
}

export interface HabitStreakMaps {
  streaks: Record<string, number>;
  failureStreaks: Record<string, number>;
}

export async function loadHabitStreakMaps(
  habits: HabitStreakInput[],
): Promise<HabitStreakMaps> {
  if (habits.length === 0) {
    return { streaks: {}, failureStreaks: {} };
  }

  const db = await getDatabase();
  let totalHabits = habits.filter((h) => !habitNeedsEventMetaForCompletion(h.config));
  let metaHabits = habits.filter((h) => habitNeedsEventMetaForCompletion(h.config));

  const streaks: Record<string, number> = {};
  const failureStreaks: Record<string, number> = {};

  // One cheap query in the common case. A habit whose run is still unbroken at the
  // window edge is re-fetched with a doubled window, so a lookback limit never
  // under-reports a streak.
  for (let ext = 0; ext <= MAX_WINDOW_EXTENSIONS; ext++) {
    if (totalHabits.length === 0 && metaHabits.length === 0) break;
    const since = streakWindowSinceDate(ext);
    const last = ext === MAX_WINDOW_EXTENSIONS;
    const nextTotals: HabitStreakInput[] = [];
    const nextMeta: HabitStreakInput[] = [];

    if (totalHabits.length > 0) {
      const totalsByElement = await eventRepo.getDailyTotalsForElementsSince(
        db,
        totalHabits.map((h) => h.id),
        since,
      );
      for (const habit of totalHabits) {
        const result = computeHabitStreaksFromDailyTotals(
          totalsByElement.get(habit.id) ?? [],
          habit.config,
          undefined,
          createdOnDate(habit.createdAt),
          since,
        );
        if (result.truncated && !last) {
          nextTotals.push(habit);
          continue;
        }
        streaks[habit.id] = result.streak;
        failureStreaks[habit.id] = result.failureStreak;
      }
    }

    if (metaHabits.length > 0) {
      const eventsByElement = await fetchHabitStreakEvents(
        db,
        metaHabits.map((h) => h.id),
        since,
      );
      for (const habit of metaHabits) {
        const result = computeHabitStreaksFromEvents(
          eventsByElement.get(habit.id) ?? [],
          habit.config,
          undefined,
          createdOnDate(habit.createdAt),
          since,
        );
        if (result.truncated && !last) {
          nextMeta.push(habit);
          continue;
        }
        streaks[habit.id] = result.streak;
        failureStreaks[habit.id] = result.failureStreak;
      }
    }

    totalHabits = nextTotals;
    metaHabits = nextMeta;
  }

  return { streaks, failureStreaks };
}

async function fetchHabitStreakEvents(
  db: SQLiteDatabase,
  habitIds: string[],
  since: string,
): Promise<Map<string, LifeEvent[]>> {
  if (habitIds.length === 0) return new Map();
  return eventRepo.getEventsForElementsSince(db, habitIds, since);
}

export async function loadHabitStreakForElement(
  elementId: string,
  config: HabitConfig,
  createdAt?: string | null,
): Promise<{ streak: number; failureStreak: number }> {
  let resolvedCreatedAt = createdAt;
  if (resolvedCreatedAt === undefined) {
    try {
      const db = await getDatabase();
      resolvedCreatedAt = await elementRepo.getElementCreatedAt(db, elementId);
    } catch {
      resolvedCreatedAt = null;
    }
  }
  const maps = await loadHabitStreakMaps([
    { id: elementId, config, createdAt: resolvedCreatedAt },
  ]);
  return {
    streak: maps.streaks[elementId] ?? 0,
    failureStreak: maps.failureStreaks[elementId] ?? 0,
  };
}
