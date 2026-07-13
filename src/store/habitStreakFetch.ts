import type { SQLiteDatabase } from 'expo-sqlite';
import type { HabitConfig, LifeEvent } from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import { getDatabase } from '../db/client';
import { streakHistorySinceDate } from '../utils/dates';
import { computeHabitStreaksFromEvents } from '../utils/habitStreakCompute';

export interface HabitStreakInput {
  id: string;
  config: HabitConfig;
}

export interface HabitStreakMaps {
  streaks: Record<string, number>;
  failureStreaks: Record<string, number>;
}

export function computeStreakMapsFromEvents(
  habits: HabitStreakInput[],
  eventsByElement: Map<string, LifeEvent[]>,
): HabitStreakMaps {
  const streaks: Record<string, number> = {};
  const failureStreaks: Record<string, number> = {};

  for (const { id, config } of habits) {
    const events = eventsByElement.get(id) ?? [];
    const result = computeHabitStreaksFromEvents(events, config);
    streaks[id] = result.streak;
    failureStreaks[id] = result.failureStreak;
  }

  return { streaks, failureStreaks };
}

export async function fetchHabitStreakEvents(
  db: SQLiteDatabase,
  habitIds: string[],
  since = streakHistorySinceDate(),
): Promise<Map<string, LifeEvent[]>> {
  if (habitIds.length === 0) return new Map();
  return eventRepo.getEventsForElementsSince(db, habitIds, since);
}

export async function fetchHabitYearEvents(elementId: string): Promise<LifeEvent[]> {
  const db = await getDatabase();
  return eventRepo.getEventsForElementSince(db, elementId, streakHistorySinceDate());
}

export async function loadHabitStreakMaps(
  habits: HabitStreakInput[],
): Promise<HabitStreakMaps> {
  if (habits.length === 0) {
    return { streaks: {}, failureStreaks: {} };
  }

  const db = await getDatabase();
  const eventsByElement = await fetchHabitStreakEvents(
    db,
    habits.map((habit) => habit.id),
  );
  return computeStreakMapsFromEvents(habits, eventsByElement);
}

export async function loadHabitStreakForElement(
  elementId: string,
  config: HabitConfig,
): Promise<{ streak: number; failureStreak: number }> {
  const maps = await loadHabitStreakMaps([{ id: elementId, config }]);
  return {
    streak: maps.streaks[elementId] ?? 0,
    failureStreak: maps.failureStreaks[elementId] ?? 0,
  };
}
