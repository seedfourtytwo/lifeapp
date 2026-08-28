/**
 * Dataset generations — the guard against an in-flight write landing in a
 * dataset that no longer exists.
 *
 * Importing a backup or clearing data replaces rows underneath writes that are
 * already awaiting SQLite. Such a write must not commit: it would resurrect a
 * row from the discarded dataset, or overwrite one that was just imported.
 * Every destructive path bumps the generation of what it touched; a write
 * captures its scope's generation before it starts and re-checks it after each
 * await, abandoning itself the moment the ground moved.
 *
 * Scopes are deliberately not collapsed into one global counter. A partial
 * clear (calendar only, weather only) must invalidate only the writes it
 * actually invalidated — one counter would silently discard unrelated in-flight
 * counter, todo or catalog writes as a side effect.
 */

import { withDbWriteLock } from './writeLock';

const ALL_SCOPES = [
  'protocol',
  'calendar',
  'weather',
  'catalog',
  'todos',
  'journal',
] as const;

/** One counter per group of rows that import/clear can replace independently. */
export type DataScope = (typeof ALL_SCOPES)[number];

export interface WriteGuard {
  /** True once this scope was replaced since the write began. Re-check after every await. */
  superseded: () => boolean;
}

const generations = new Map<DataScope, number>();

/** Called when a scope's rows are replaced or wiped. Invalidates in-flight writes. */
export function bumpDataGeneration(scope: DataScope): void {
  generations.set(scope, (generations.get(scope) ?? 0) + 1);
}

/** A full import or clear-everything replaces every scope at once. */
export function bumpAllDataGenerations(): void {
  for (const scope of ALL_SCOPES) bumpDataGeneration(scope);
}

export function getDataGeneration(scope: DataScope): number {
  return generations.get(scope) ?? 0;
}

/**
 * The sanctioned way to write. Takes the shared write lock, captures the
 * scope's generation before queueing, and hands the body a `superseded()` it
 * must re-check after every await before touching the DB or a store.
 *
 * Resolves to `undefined` — without running the body — if the dataset was
 * replaced while this write waited for the lock, which is the common case: the
 * import or clear holds the lock for its whole transaction.
 */
export async function withGuardedWrite<T>(
  scope: DataScope,
  run: (guard: WriteGuard) => Promise<T>,
): Promise<T | undefined> {
  const generationAtStart = getDataGeneration(scope);
  const guard: WriteGuard = {
    superseded: () => getDataGeneration(scope) !== generationAtStart,
  };
  return withDbWriteLock(async () => (guard.superseded() ? undefined : run(guard)));
}

/** Test helper — reset module state between tests. */
export function resetDataGenerationsForTests(): void {
  generations.clear();
}
