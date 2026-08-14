import type { SQLiteDatabase } from 'expo-sqlite';
import type { DayNote } from '../../protocol';
import { DAY_NOTE_BODY_MAX_LENGTH, DayNoteSchema, PROTOCOL_VERSION } from '../../protocol';
import { newId } from '../../utils/id';

interface DayNoteRow {
  id: string;
  element_id: string;
  date: string;
  body: string;
  updated_at: string;
  protocol_version: number;
}

function rowToNote(row: DayNoteRow): DayNote {
  return DayNoteSchema.parse({
    id: row.id,
    elementId: row.element_id,
    date: row.date,
    body: row.body,
    updatedAt: row.updated_at,
    protocolVersion: PROTOCOL_VERSION,
  });
}

/** Skip corrupt rows so one bad note cannot break history / export. */
function tryRowToNote(row: DayNoteRow): DayNote | null {
  try {
    return rowToNote(row);
  } catch {
    return null;
  }
}

function mapRows(rows: DayNoteRow[]): DayNote[] {
  const notes: DayNote[] = [];
  for (const row of rows) {
    const note = tryRowToNote(row);
    if (note) notes.push(note);
  }
  return notes;
}

export async function getNote(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<DayNote | null> {
  const row = await db.getFirstAsync<DayNoteRow>(
    'SELECT * FROM day_notes WHERE element_id = ? AND date = ?',
    elementId,
    date,
  );
  return row ? tryRowToNote(row) : null;
}

export async function getNotesForElementInRange(
  db: SQLiteDatabase,
  elementId: string,
  sinceDate: string,
): Promise<DayNote[]> {
  const rows = await db.getAllAsync<DayNoteRow>(
    `SELECT * FROM day_notes
     WHERE element_id = ? AND date >= ?
     ORDER BY date ASC`,
    elementId,
    sinceDate,
  );
  return mapRows(rows);
}

/** Notes for many elements on a single calendar day. */
export async function getNotesForElementsOnDate(
  db: SQLiteDatabase,
  elementIds: string[],
  date: string,
): Promise<Map<string, DayNote>> {
  const byElement = new Map<string, DayNote>();
  if (elementIds.length === 0) return byElement;

  const placeholders = elementIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<DayNoteRow>(
    `SELECT * FROM day_notes
     WHERE date = ? AND element_id IN (${placeholders})`,
    date,
    ...elementIds,
  );
  for (const row of rows) {
    const note = tryRowToNote(row);
    if (note) byElement.set(note.elementId, note);
  }
  return byElement;
}

/**
 * Past dates that have tracker notes but no daily journal.
 * Scoped to `elementIds` (e.g. active trackers only) and excludes `excludeDate` (usually today).
 */
export async function getDatesWithTrackerNotesOnly(
  db: SQLiteDatabase,
  elementIds: string[],
  excludeDate: string,
): Promise<string[]> {
  if (elementIds.length === 0) return [];

  const placeholders = elementIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT dn.date AS date
     FROM day_notes dn
     WHERE dn.element_id IN (${placeholders})
       AND dn.date != ?
       AND NOT EXISTS (
         SELECT 1 FROM daily_journals dj WHERE dj.date = dn.date
       )
     ORDER BY dn.date DESC`,
    ...elementIds,
    excludeDate,
  );
  return rows.map((row) => row.date);
}

/** Dates that have at least one tracker note for the given elements. */
export async function getDatesWithTrackerNotes(
  db: SQLiteDatabase,
  elementIds: string[],
): Promise<string[]> {
  if (elementIds.length === 0) return [];

  const placeholders = elementIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT dn.date AS date
     FROM day_notes dn
     WHERE dn.element_id IN (${placeholders})
     ORDER BY dn.date DESC`,
    ...elementIds,
  );
  return rows.map((row) => row.date);
}

export async function getAllNotes(db: SQLiteDatabase): Promise<DayNote[]> {
  const rows = await db.getAllAsync<DayNoteRow>(
    'SELECT * FROM day_notes ORDER BY date ASC, updated_at ASC',
  );
  return mapRows(rows);
}

export async function insertNote(db: SQLiteDatabase, note: DayNote): Promise<void> {
  const parsed = DayNoteSchema.parse({
    ...note,
    body: note.body.trim(),
  });
  await db.runAsync(
    `INSERT INTO day_notes (id, element_id, date, body, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.elementId,
    parsed.date,
    parsed.body,
    parsed.updatedAt,
    parsed.protocolVersion,
  );
}

/**
 * Upsert note body for (elementId, date). Whitespace-only body deletes the row.
 * Returns the saved note, or null when cleared.
 */
export async function upsertNote(
  db: SQLiteDatabase,
  input: { elementId: string; date: string; body: string },
): Promise<DayNote | null> {
  const trimmed = input.body.trim();
  if (trimmed.length === 0) {
    await deleteNoteForElementOnDate(db, input.elementId, input.date);
    return null;
  }
  if (trimmed.length > DAY_NOTE_BODY_MAX_LENGTH) {
    throw new Error(`Note must be at most ${DAY_NOTE_BODY_MAX_LENGTH} characters`);
  }

  const existing = await getNote(db, input.elementId, input.date);
  const note = DayNoteSchema.parse({
    id: existing?.id ?? newId(),
    elementId: input.elementId,
    date: input.date,
    body: trimmed,
    updatedAt: new Date().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
  });

  await db.runAsync(
    `INSERT INTO day_notes (id, element_id, date, body, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(element_id, date) DO UPDATE SET
       id = excluded.id,
       body = excluded.body,
       updated_at = excluded.updated_at,
       protocol_version = excluded.protocol_version`,
    note.id,
    note.elementId,
    note.date,
    note.body,
    note.updatedAt,
    note.protocolVersion,
  );

  // Re-read so returned id matches DB (including healed primary keys).
  return getNote(db, input.elementId, input.date);
}

export async function deleteNoteForElementOnDate(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM day_notes WHERE element_id = ? AND date = ?',
    elementId,
    date,
  );
}

export async function deleteAllNotes(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM day_notes');
}

/** Delete notes with local `date` strictly before `beforeDate` (YYYY-MM-DD). */
export async function deleteNotesBeforeDate(
  db: SQLiteDatabase,
  beforeDate: string,
): Promise<void> {
  await db.runAsync('DELETE FROM day_notes WHERE date < ?', beforeDate);
}
