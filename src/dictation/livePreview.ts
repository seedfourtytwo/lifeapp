export type DictationLivePreview = {
  /** Finalized phrases in this take. */
  committed: string;
  /** Current hypothesis (italic in the editor). */
  tail: string;
};

export function livePreviewLength(live: DictationLivePreview | null): number {
  if (!live) return 0;
  const committed = live.committed.trim();
  const tail = live.tail.trim();
  if (!committed) return tail.length;
  if (!tail) return committed.length;
  return committed.length + 1 + tail.length;
}

export function livePreviewsEqual(
  a: DictationLivePreview | null,
  b: DictationLivePreview | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.committed === b.committed && a.tail === b.tail;
}
