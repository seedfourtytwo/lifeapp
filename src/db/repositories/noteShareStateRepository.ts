import type { SQLiteDatabase } from 'expo-sqlite';

export type NoteShareKind = 'journal' | 'tracker';

/**
 * What a row of `note_share_state` is keyed by.
 *
 * - tracker: `elementId` is the tracker, `entryId` empty — one day note, one row.
 * - journal: `elementId` is the notebook, `entryId` is the `daily_journals`
 *   row — one row per **chapter**, because chapters are shared one at a time.
 *
 * Before chapters could be picked, a journal put the notebook id in `entryId`
 * and left `elementId` empty, keeping one fingerprint for the whole day. Those
 * rows are never read now, so the icon falls back to "never shared" — which is
 * free: the table is `bundleKey: null`, a disposable local cache that is never
 * backed up, so nothing is lost and no migration is owed.
 */
export type NoteShareTarget = {
  kind: NoteShareKind;
  /** Tracker element id, or journal notebook id. */
  elementId: string;
  /** Journal `daily_journals` chapter id; empty string for tracker notes. */
  entryId: string;
};

interface ShareStateRow {
  body_fp: string;
}

export async function getShareFingerprint(
  db: SQLiteDatabase,
  target: NoteShareTarget,
  date: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<ShareStateRow>(
    `SELECT body_fp FROM note_share_state
     WHERE kind = ? AND element_id = ? AND entry_id = ? AND date = ?`,
    target.kind,
    target.elementId,
    target.entryId,
    date,
  );
  return row?.body_fp ?? null;
}

export async function upsertShareState(
  db: SQLiteDatabase,
  target: NoteShareTarget,
  date: string,
  bodyFp: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO note_share_state (kind, element_id, entry_id, date, body_fp, shared_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind, element_id, entry_id, date) DO UPDATE SET
       body_fp = excluded.body_fp,
       shared_at = excluded.shared_at`,
    target.kind,
    target.elementId,
    target.entryId,
    date,
    bodyFp,
    new Date().toISOString(),
  );
}

export async function deleteShareState(
  db: SQLiteDatabase,
  target: NoteShareTarget,
  date: string,
): Promise<void> {
  await db.runAsync(
    `DELETE FROM note_share_state
     WHERE kind = ? AND element_id = ? AND entry_id = ? AND date = ?`,
    target.kind,
    target.elementId,
    target.entryId,
    date,
  );
}

/** Every chapter of one notebook day that has been shared, by chapter id. */
export async function getJournalDayShareFingerprints(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ entry_id: string; body_fp: string }>(
    `SELECT entry_id, body_fp FROM note_share_state
     WHERE kind = 'journal' AND element_id = ? AND date = ?`,
    notebookId,
    date,
  );
  const found: Record<string, string> = {};
  for (const row of rows) found[row.entry_id] = row.body_fp;
  return found;
}

/**
 * Record what just went to the share sheet, one row per chapter that was in it.
 *
 * Also clears any pre-chapter row for the same notebook day — the old
 * whole-day key nobody reads any more. Doing it here rather than in a
 * migration keeps the sweep where it costs nothing and cannot fail a startup:
 * a day the reader never shares again simply keeps an inert cache row.
 */
export async function upsertJournalChapterShareState(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
  entries: readonly { chapterId: string; bodyFp: string }[],
): Promise<void> {
  for (const entry of entries) {
    await upsertShareState(
      db,
      { kind: 'journal', elementId: notebookId, entryId: entry.chapterId },
      date,
      entry.bodyFp,
    );
  }
  await db.runAsync(
    `DELETE FROM note_share_state
     WHERE kind = 'journal' AND element_id = '' AND entry_id = ? AND date = ?`,
    notebookId,
    date,
  );
}

/** Both key shapes: the notebook as element, and the pre-chapter rows as entry. */
export async function deleteShareStateForJournalNotebook(
  db: SQLiteDatabase,
  notebookId: string,
): Promise<void> {
  await db.runAsync(
    `DELETE FROM note_share_state
     WHERE kind = 'journal' AND (element_id = ? OR (element_id = '' AND entry_id = ?))`,
    notebookId,
    notebookId,
  );
}

export async function deleteAllShareState(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM note_share_state');
}

export async function deleteShareStateBeforeDate(
  db: SQLiteDatabase,
  beforeDate: string,
): Promise<void> {
  await db.runAsync('DELETE FROM note_share_state WHERE date < ?', beforeDate);
}
