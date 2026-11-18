/** Per-element write epochs so bulk loads can't overwrite fresher mutations. */

const writeEpochs = new Map<string, number>();
/**
 * Writes that have bumped their epoch but not yet settled. A load that starts
 * while one is pending would otherwise capture the already-bumped epoch, read
 * SQLite before the write commits, and paint over the optimistic value.
 */
const pendingWrites = new Map<string, number>();
/** Captured in place of an epoch when a write was pending at capture time. */
const CAPTURED_WHILE_PENDING = -1;

export function getWriteEpoch(elementId: string): number {
  return writeEpochs.get(elementId) ?? 0;
}

export function bumpWriteEpoch(elementId: string): number {
  const next = (writeEpochs.get(elementId) ?? 0) + 1;
  writeEpochs.set(elementId, next);
  return next;
}

export function clearWriteEpoch(elementId: string): void {
  writeEpochs.delete(elementId);
}

/**
 * Mark a write to `id` as in flight until the returned release runs (call it
 * in `finally`). Loads drop `id` while any write to it is pending.
 */
export function beginPendingWrite(id: string): () => void {
  pendingWrites.set(id, (pendingWrites.get(id) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (pendingWrites.get(id) ?? 1) - 1;
    if (left > 0) pendingWrites.set(id, left);
    else pendingWrites.delete(id);
  };
}

export function captureWriteEpochs(ids: Iterable<string>): Map<string, number> {
  const captured = new Map<string, number>();
  for (const id of ids) {
    captured.set(
      id,
      pendingWrites.has(id) ? CAPTURED_WHILE_PENDING : (writeEpochs.get(id) ?? 0),
    );
  }
  return captured;
}

/**
 * Keep only entries whose write epoch is unchanged since capture, and which had
 * no write in flight at capture or now — those writes reconcile themselves.
 */
export function mergeUnchangedEntries<T>(
  loaded: Record<string, T>,
  captured: Map<string, number>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, value] of Object.entries(loaded)) {
    if (pendingWrites.has(id)) continue;
    if ((writeEpochs.get(id) ?? 0) === (captured.get(id) ?? 0)) {
      out[id] = value;
    }
  }
  return out;
}

/** Test helper — reset module state between tests. */
export function resetWriteEpochsForTests(): void {
  writeEpochs.clear();
  pendingWrites.clear();
}
