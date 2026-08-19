import type { SQLiteDatabase } from 'expo-sqlite';
import {
  habitNeedsEventMetaForCompletion,
  type HabitConfig,
  type LifeEvent,
} from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { getDatabase } from '../db/client';
import { streakHistorySinceDate } from '../utils/dates';
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
  const since = streakHistorySinceDate();
  const metaHabits = habits.filter((h) => habitNeedsEventMetaForCompletion(h.config));
  const totalHabits = habits.filter((h) => !habitNeedsEventMetaForCompletion(h.config));

  const streaks: Record<string, number> = {};
  const failureStreaks: Record<string, number> = {};

  if (totalHabits.length > 0) {
    const totalsByElement = await eventRepo.getDailyTotalsForElementsSince(
      db,
      totalHabits.map((h) => h.id),
      since,
    );
    for (const { id, config, createdAt } of totalHabits) {
      const result = computeHabitStreaksFromDailyTotals(
        totalsByElement.get(id) ?? [],
        config,
        undefined,
        createdOnDate(createdAt),
      );
      streaks[id] = result.streak;
      failureStreaks[id] = result.failureStreak;
    }
  }

  if (metaHabits.length > 0) {
    const eventsByElement = await fetchHabitStreakEvents(
      db,
      metaHabits.map((h) => h.id),
      since,
    );
    for (const { id, config, createdAt } of metaHabits) {
      const result = computeHabitStreaksFromEvents(
        eventsByElement.get(id) ?? [],
        config,
        undefined,
        createdOnDate(createdAt),
      );
      streaks[id] = result.streak;
      failureStreaks[id] = result.failureStreak;
    }
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
