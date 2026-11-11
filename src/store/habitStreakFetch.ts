import type { HabitConfig } from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { getDatabase } from '../db/client';
import { streakHistorySinceDate } from '../utils/dates';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { computeTrackerStreaks } from '../utils/trackerStreaks';

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
  const factsByElement = await eventRepo.getDayFactsForElementsSince(
    db,
    habits.map((h) => h.id),
    streakHistorySinceDate(),
  );

  const streaks: Record<string, number> = {};
  const failureStreaks: Record<string, number> = {};
  for (const { id, config, createdAt } of habits) {
    const result = computeTrackerStreaks(
      { kind: 'habit', config },
      factsByElement.get(id) ?? [],
      undefined,
      createdOnDate(createdAt),
    );
    streaks[id] = result.streak;
    failureStreaks[id] = result.failureStreak;
  }
  return { streaks, failureStreaks };
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
