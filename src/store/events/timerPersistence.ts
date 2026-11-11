import type { ActiveTimerSession } from '../../protocol';
import { getDatabase } from '../../db/client';
import {
  loadPersistedActiveTimerSessions,
  persistActiveTimerSessions,
} from '../../db/repositories/activeTimerRepository';

/** Saves of the timer sessions, one after another, so the last one written is the newest. */
let persistTimersChain: Promise<void> = Promise.resolve();
/** Bumped on every save, so a read of the saved form can tell it was overtaken. */
let persistTimersSeq = 0;

/** Production waits for bootstrap hydrate; tests start ready so unit tests don't hang. */
let activeTimersReady = process.env.NODE_ENV === 'test';
let activeTimersReadyWaiters: (() => void)[] = [];

export function isActiveTimersReady(): boolean {
  return activeTimersReady;
}

/** Resolves after bootstrap finishes timer hydrate + day-state (or immediately in tests). */
export function whenActiveTimersReady(): Promise<void> {
  if (activeTimersReady) return Promise.resolve();
  return new Promise((resolve) => {
    activeTimersReadyWaiters.push(resolve);
  });
}

/** Called from bootstrap after hydrate/day-state, or on element-load failure. */
export function releaseActiveTimersReady(): void {
  activeTimersReady = true;
  const waiters = activeTimersReadyWaiters;
  activeTimersReadyWaiters = [];
  for (const wake of waiters) wake();
}

export function schedulePersistActiveTimers(
  sessions: Record<string, ActiveTimerSession>,
): void {
  persistTimersSeq += 1;
  persistTimersChain = persistTimersChain
    .catch(() => undefined)
    .then(async () => persistActiveTimerSessions(await getDatabase(), sessions))
    .catch((error) => {
      console.warn('Failed to persist active timer sessions', error);
    });
}

/**
 * The sessions as last saved, once every save asked for so far has landed;
 * null when another save was asked for while reading, since memory is newer.
 */
export async function loadSavedSessionsUnlessOvertaken(): Promise<Record<
  string,
  ActiveTimerSession
> | null> {
  await persistTimersChain;
  const seqAtRead = persistTimersSeq;
  const saved = await loadPersistedActiveTimerSessions(await getDatabase());
  return seqAtRead === persistTimersSeq ? saved : null;
}
