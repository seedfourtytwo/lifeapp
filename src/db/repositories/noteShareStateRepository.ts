import type { SQLiteDatabase } from 'expo-sqlite';

export type NoteShareKind = 'journal' | 'tracker';

export type NoteShareTarget = {
  kind: NoteShareKind;
  /** Empty string for journals. */
  elementId: string;
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
     WHERE kind = ? AND element_id = ? AND date = ?`,
    target.kind,
    target.elementId,
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
    `INSERT INTO note_share_state (kind, element_id, date, body_fp, shared_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(kind, element_id, date) DO UPDATE SET
       body_fp = excluded.body_fp,
       shared_at = excluded.shared_at`,
    target.kind,
    target.elementId,
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
     WHERE kind = ? AND element_id = ? AND date = ?`,
    target.kind,
    target.elementId,
    date,
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
