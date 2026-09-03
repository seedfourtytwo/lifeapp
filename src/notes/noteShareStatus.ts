export type NoteShareStatus = 'never' | 'stale' | 'current';

export type NoteSharePalette = {
  /** Saved and matches last share (success). */
  current: string;
  /** Shared before, but draft or saved copy differs. */
  stale: string;
  /** Never shared — still looks tappable, not like a success state. */
  idle: string;
};

/** Amber that meets contrast on light surfaces / dark slate. */
export const NOTE_SHARE_STALE_LIGHT = '#B45309';
export const NOTE_SHARE_STALE_DARK = '#EAB308';

/** Stable fingerprint of note text for last-shared comparison. */
export function noteBodyFingerprint(body: string): string {
  const text = body.trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length.toString(16)}:${(hash >>> 0).toString(16)}`;
}

/**
 * never — no successful share yet
 * stale — shared before, but draft or SQLite copy differs
 * current — this draft is saved and matches the last share
 */
export function noteShareStatus(opts: {
  draft: string;
  persisted: string;
  lastSharedFingerprint: string | null;
}): NoteShareStatus {
  const last = opts.lastSharedFingerprint;
  if (!last || !opts.draft.trim()) return 'never';
  const draftFp = noteBodyFingerprint(opts.draft);
  const persistedFp = noteBodyFingerprint(opts.persisted);
  if (draftFp === last && persistedFp === last) return 'current';
  return 'stale';
}

/** One chapter's side of the comparison: what it says, what is saved, what went out. */
export type JournalChapterShareState = {
  draft: string;
  persisted: string;
  lastSharedFingerprint: string | null;
};

/**
 * One colour for a day made of several chapters.
 *
 * Each chapter carries its own last-shared fingerprint — the share sheet gets
 * the picked chapters joined, and exactly those chapters' fingerprints are
 * recorded — so the day's status is the roll-up of the parts:
 *
 * - **current** only when every chapter with text is saved and matches what
 *   went out, i.e. there is nothing left to send.
 * - **never** when nothing has been sent, or nothing is written.
 * - **stale** for everything else, which now includes the case a day-level
 *   fingerprint could not see: one chapter shared, a second written after.
 *
 * A blank chapter is skipped. It reaches no file, so it cannot be out of date.
 */
export function journalDayShareStatus(
  chapters: readonly JournalChapterShareState[],
): NoteShareStatus {
  const written = chapters.filter((chapter) => chapter.draft.trim().length > 0);
  if (written.length === 0) return 'never';
  const statuses = written.map(noteShareStatus);
  if (statuses.every((status) => status === 'current')) return 'current';
  if (statuses.every((status) => status === 'never')) return 'never';
  return 'stale';
}

/** Share is an action, not a status chip — hide it unless it can actually run. */
export function canShowNoteShare(opts: {
  hasDraftText: boolean;
  dictationBusy: boolean;
  shareAvailable: boolean;
  saving?: boolean;
}): boolean {
  return (
    opts.shareAvailable &&
    opts.hasDraftText &&
    !opts.dictationBusy &&
    !opts.saving
  );
}

export function noteShareActionColor(
  status: NoteShareStatus,
  palette: NoteSharePalette,
): string {
  if (status === 'current') return palette.current;
  if (status === 'stale') return palette.stale;
  return palette.idle;
}
