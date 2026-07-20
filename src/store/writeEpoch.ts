/** Per-element write epochs so bulk loads can't overwrite fresher mutations. */

const writeEpochs = new Map<string, number>();

export function bumpWriteEpoch(elementId: string): number {
  const next = (writeEpochs.get(elementId) ?? 0) + 1;
  writeEpochs.set(elementId, next);
  return next;
}

export function clearWriteEpoch(elementId: string): void {
  writeEpochs.delete(elementId);
}

export function captureWriteEpochs(ids: Iterable<string>): Map<string, number> {
  const captured = new Map<string, number>();
  for (const id of ids) {
    captured.set(id, writeEpochs.get(id) ?? 0);
  }
  return captured;
}

/** Keep only entries whose write epoch is unchanged since capture. */
export function mergeUnchangedEntries<T>(
  loaded: Record<string, T>,
  captured: Map<string, number>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, value] of Object.entries(loaded)) {
    if ((writeEpochs.get(id) ?? 0) === (captured.get(id) ?? 0)) {
      out[id] = value;
    }
  }
  return out;
}

/** Test helper — reset module state between tests. */
export function resetWriteEpochsForTests(): void {
  writeEpochs.clear();
}
