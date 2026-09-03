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

/**
 * The take so far as one line, for a field that has no room to italicise a
 * tail. Same joining rule as `livePreviewLength`, so what is shown and what is
 * counted never disagree.
 */
export function livePreviewText(live: DictationLivePreview | null): string {
  if (!live) return '';
  const committed = live.committed.trim();
  const tail = live.tail.trim();
  if (!committed) return tail;
  if (!tail) return committed;
  return `${committed} ${tail}`;
}

export function livePreviewsEqual(
  a: DictationLivePreview | null,
  b: DictationLivePreview | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.committed === b.committed && a.tail === b.tail;
}
