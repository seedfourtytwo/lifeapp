import type { CounterConfig } from '../protocol';
import * as eventRepo from '../db/repositories/eventRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import { getDatabase } from '../db/client';
import { MAX_WINDOW_EXTENSIONS, streakWindowSinceDate } from '../utils/dates';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { computeCounterStreaks } from '../utils/counterStreakCompute';

export interface CounterStreakInput {
  id: string;
  config: CounterConfig;
  createdAt?: string | null;
}

export interface CounterStreakMaps {
  streaks: Record<string, number>;
  /** Strength score 0–100, from the first (365-day) window only — see HabitStreakMaps. */
  scores: Record<string, number>;
}

export async function loadCounterStreakMaps(
  counters: CounterStreakInput[],
): Promise<CounterStreakMaps> {
  let pending = counters.filter(
    (c) => c.config.dailyTarget !== undefined && c.config.dailyTarget > 0,
  );
  if (pending.length === 0) return { streaks: {}, scores: {} };

  const db = await getDatabase();
  const streaks: Record<string, number> = {};
  const scores: Record<string, number> = {};

  // One cheap query in the common case; a counter whose run is still unbroken at the
  // window edge is re-fetched with a doubled window.
  for (let ext = 0; ext <= MAX_WINDOW_EXTENSIONS && pending.length > 0; ext++) {
    const since = streakWindowSinceDate(ext);
    const last = ext === MAX_WINDOW_EXTENSIONS;
    const totalsByElement = await eventRepo.getDailyTotalsForElementsSince(
      db,
      pending.map((c) => c.id),
      since,
    );
    const next: CounterStreakInput[] = [];
    for (const counter of pending) {
      const dailyTarget = counter.config.dailyTarget;
      if (dailyTarget === undefined || dailyTarget <= 0) continue;
      const result = computeCounterStreaks(
        totalsByElement.get(counter.id) ?? [],
        dailyTarget,
        undefined,
        createdOnLocalDate(counter.createdAt),
        since,
      );
      if (ext === 0) scores[counter.id] = result.score;
      if (result.truncated && !last) {
        next.push(counter);
        continue;
      }
      streaks[counter.id] = result.streak;
    }
    pending = next;
  }
  return { streaks, scores };
}

export async function loadCounterStreakForElement(
  elementId: string,
  config: CounterConfig,
  createdAt?: string | null,
): Promise<{ streak: number; score: number }> {
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
  return { streak: maps.streaks[elementId] ?? 0, score: maps.scores[elementId] ?? 0 };
}
