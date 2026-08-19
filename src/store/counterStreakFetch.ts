import type { CounterConfig } from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { getDatabase } from '../db/client';
import { streakHistorySinceDate } from '../utils/dates';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { computeCounterTargetStreak } from '../utils/counterStreakCompute';

export interface CounterStreakInput {
  id: string;
  config: CounterConfig;
  createdAt?: string | null;
}

export async function loadCounterStreakMaps(
  counters: CounterStreakInput[],
): Promise<Record<string, number>> {
  const withTarget = counters.filter(
    (c) => c.config.dailyTarget !== undefined && c.config.dailyTarget > 0,
  );
  if (withTarget.length === 0) return {};

  const db = await getDatabase();
  const since = streakHistorySinceDate();
  const totalsByElement = await eventRepo.getDailyTotalsForElementsSince(
    db,
    withTarget.map((c) => c.id),
    since,
  );

  const streaks: Record<string, number> = {};
  for (const { id, config, createdAt } of withTarget) {
    const dailyTarget = config.dailyTarget;
    if (dailyTarget === undefined || dailyTarget <= 0) continue;
    streaks[id] = computeCounterTargetStreak(
      totalsByElement.get(id) ?? [],
      dailyTarget,
      undefined,
      createdOnLocalDate(createdAt),
    );
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
