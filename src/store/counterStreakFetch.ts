import type { CounterConfig } from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { getDatabase } from '../db/client';
import { streakHistorySinceDate } from '../utils/dates';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { computeTrackerStreaks } from '../utils/trackerStreaks';

export interface CounterStreakInput {
  id: string;
  config: CounterConfig;
  createdAt?: string | null;
}

export async function loadCounterStreakMaps(
  counters: CounterStreakInput[],
): Promise<Record<string, number>> {
  if (counters.length === 0) return {};

  const db = await getDatabase();
  const factsByElement = await eventRepo.getDayFactsForElementsSince(
    db,
    counters.map((c) => c.id),
    streakHistorySinceDate(),
  );

  const streaks: Record<string, number> = {};
  for (const { id, config, createdAt } of counters) {
    streaks[id] = computeTrackerStreaks(
      { kind: 'counter', config },
      factsByElement.get(id) ?? [],
      undefined,
      createdOnLocalDate(createdAt),
    ).streak;
  }
  return streaks;
}

export async function loadCounterStreakForElement(
  elementId: string,
  config: CounterConfig,
  createdAt?: string | null,
): Promise<number> {
  let resolvedCreatedAt = createdAt;
  if (resolvedCreatedAt === undefined) {
    try {
      const db = await getDatabase();
      resolvedCreatedAt = await elementRepo.getElementCreatedAt(db, elementId);
    } catch {
      resolvedCreatedAt = null;
    }
  }
  const maps = await loadCounterStreakMaps([
    { id: elementId, config, createdAt: resolvedCreatedAt },
  ]);
  return maps[elementId] ?? 0;
}
