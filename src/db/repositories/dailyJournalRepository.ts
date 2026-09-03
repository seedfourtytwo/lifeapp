import type { SQLiteDatabase } from 'expo-sqlite';
import type { DailyJournal } from '../../protocol';
import {
  DAILY_JOURNAL_BODY_MAX_LENGTH,
  DailyJournalSchema,
  joinJournalDayBodies,
  PROTOCOL_VERSION,
} from '../../protocol';
import { newId } from '../../utils/id';

interface DailyJournalRow {
  id: string;
  notebook_id: string;
  date: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  protocol_version: number;
}

/** A notebook day's chapters, in the order they are read. */
const CHAPTER_ORDER = 'ORDER BY sort_order ASC, created_at ASC, updated_at ASC, id ASC';

function rowToJournal(row: DailyJournalRow): DailyJournal {
  return DailyJournalSchema.parse({
    id: row.id,
    notebookId: row.notebook_id,
    date: row.date,
    body: row.body,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    protocolVersion: PROTOCOL_VERSION,
  });
}

function tryRowToJournal(row: DailyJournalRow): DailyJournal | null {
  try {
    return rowToJournal(row);
  } catch {
    return null;
  }
}

function mapRows(rows: DailyJournalRow[]): DailyJournal[] {
  const journals: DailyJournal[] = [];
  for (const row of rows) {
    const journal = tryRowToJournal(row);
    if (journal) journals.push(journal);
  }
  return journals;
}

export async function getJournalById(
  db: SQLiteDatabase,
  id: string,
): Promise<DailyJournal | null> {
  const row = await db.getFirstAsync<DailyJournalRow>(
    'SELECT * FROM daily_journals WHERE id = ?',
    id,
  );
  return row ? tryRowToJournal(row) : null;
}

export async function getJournalsForDate(
  db: SQLiteDatabase,
  date: string,
): Promise<DailyJournal[]> {
  const rows = await db.getAllAsync<DailyJournalRow>(
    `SELECT * FROM daily_journals
     WHERE date = ?
     ORDER BY created_at DESC, updated_at DESC`,
    date,
  );
  return mapRows(rows);
}

/** Every chapter this notebook holds for the day, first to last. */
export async function getJournalChapters(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
): Promise<DailyJournal[]> {
  const rows = await db.getAllAsync<DailyJournalRow>(
    `SELECT * FROM daily_journals WHERE notebook_id = ? AND date = ? ${CHAPTER_ORDER}`,
    notebookId,
    date,
  );
  return mapRows(rows);
}

/** The day's first chapter — what opening a notebook with no chapter in mind lands on. */
export async function getFirstJournalChapter(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
): Promise<DailyJournal | null> {
  const row = await db.getFirstAsync<DailyJournalRow>(
    `SELECT * FROM daily_journals WHERE notebook_id = ? AND date = ? ${CHAPTER_ORDER} LIMIT 1`,
    notebookId,
    date,
  );
  return row ? tryRowToJournal(row) : null;
}

/** The whole day as one text — what copy, share and export emit. */
export async function getJournalDayBody(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
): Promise<string> {
  const chapters = await getJournalChapters(db, notebookId, date);
  return joinJournalDayBodies(chapters.map((chapter) => chapter.body));
}

/** Chapters per notebook for one day — the count the Home note icon badges. */
export async function getJournalChapterCountsOnDate(
  db: SQLiteDatabase,
  date: string,
): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ notebook_id: string; n: number }>(
    `SELECT notebook_id, COUNT(*) AS n FROM daily_journals
     WHERE date = ? AND length(trim(body)) > 0
     GROUP BY notebook_id`,
    date,
  );
  return new Map(rows.map((row) => [row.notebook_id, Number(row.n)]));
}

export async function getAllJournals(db: SQLiteDatabase): Promise<DailyJournal[]> {
  const rows = await db.getAllAsync<DailyJournalRow>(
    `SELECT * FROM daily_journals ORDER BY date DESC, notebook_id ASC, sort_order ASC, created_at ASC`,
  );
  return mapRows(rows);
}

/** Where a brand new chapter lands: after everything already written that day. */
export async function nextChapterSortOrder(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM daily_journals WHERE notebook_id = ? AND date = ?',
    notebookId,
    date,
  );
  return (row?.m ?? -1) + 1;
}

/** Renumber a day's chapters 0..n-1 so a delete does not leave a hole. */
async function renumberChapters(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; sort_order: number }>(
    `SELECT id, sort_order FROM daily_journals WHERE notebook_id = ? AND date = ? ${CHAPTER_ORDER}`,
    notebookId,
    date,
  );
  for (const [index, row] of rows.entries()) {
    if (row.sort_order === index) continue;
    await db.runAsync('UPDATE daily_journals SET sort_order = ? WHERE id = ?', index, row.id);
  }
}

export async function insertJournal(
  db: SQLiteDatabase,
  journal: DailyJournal,
): Promise<void> {
  const parsed = DailyJournalSchema.parse({
    ...journal,
    body: journal.body.trim(),
  });
  await db.runAsync(
    `INSERT INTO daily_journals
      (id, notebook_id, date, body, sort_order, created_at, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.notebookId,
    parsed.date,
    parsed.body,
    parsed.sortOrder,
    parsed.createdAt,
    parsed.updatedAt,
    parsed.protocolVersion,
  );
}

/**
 * Write one chapter of a notebook day.
 *
 * Row-addressed, and that is the whole difference from the pre-v22 version:
 * `id` names the chapter being edited. An `id` that is not on file yet is a new
 * chapter — the editor mints it when the reader taps "add" — and it lands after
 * everything already written that day. With no `id` at all this falls back to
 * the day's first chapter, which is what opening a notebook plainly means.
 *
 * A whitespace-only body deletes *that chapter*, never the day. Returns the
 * saved chapter, or null when it was cleared.
 */
export async function upsertJournal(
  db: SQLiteDatabase,
  input: { id?: string; notebookId: string; date: string; body: string },
): Promise<DailyJournal | null> {
  const trimmed = input.body.trim();
  const existing = input.id
    ? await getJournalById(db, input.id)
    : await getFirstJournalChapter(db, input.notebookId, input.date);
  if (trimmed.length === 0) {
    const doomed = existing?.id ?? null;
    if (doomed) await deleteJournal(db, doomed);
    return null;
  }
  if (trimmed.length > DAILY_JOURNAL_BODY_MAX_LENGTH) {
    throw new Error(`Journal must be at most ${DAILY_JOURNAL_BODY_MAX_LENGTH} characters`);
  }

  const now = new Date().toISOString();
  const journal = DailyJournalSchema.parse({
    id: existing?.id ?? input.id ?? newId(),
    notebookId: existing?.notebookId ?? input.notebookId,
    date: existing?.date ?? input.date,
    body: trimmed,
    sortOrder:
      existing?.sortOrder ??
      (await nextChapterSortOrder(db, input.notebookId, input.date)),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    protocolVersion: PROTOCOL_VERSION,
  });

  await db.runAsync(
    `INSERT INTO daily_journals
      (id, notebook_id, date, body, sort_order, created_at, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       body = excluded.body,
       updated_at = excluded.updated_at,
       protocol_version = excluded.protocol_version`,
    journal.id,
    journal.notebookId,
    journal.date,
    journal.body,
    journal.sortOrder,
    journal.createdAt,
    journal.updatedAt,
    journal.protocolVersion,
  );

  return getJournalById(db, journal.id);
}

/**
 * Move a notebook's chapters to another notebook, keeping every one of them.
 *
 * Up to v21 a collision on the destination day was resolved by joining the two
 * bodies, because the destination could only hold one. Now the moved chapters
 * are simply appended after the ones already there — no text is rewritten, and
 * deleting a notebook stays the reassign-then-delete dance the missing
 * `ON DELETE CASCADE` demands.
 */
export async function reassignJournalsToNotebook(
  db: SQLiteDatabase,
  fromNotebookId: string,
  toNotebookId: string,
): Promise<void> {
  if (fromNotebookId === toNotebookId) return;
  const fromRows = await db.getAllAsync<DailyJournalRow>(
    `SELECT * FROM daily_journals WHERE notebook_id = ? ORDER BY date ASC, sort_order ASC, created_at ASC`,
    fromNotebookId,
  );
  const touchedDates = new Set<string>();
  for (const row of fromRows) {
    const sortOrder = await nextChapterSortOrder(db, toNotebookId, row.date);
    await db.runAsync(
      'UPDATE daily_journals SET notebook_id = ?, sort_order = ? WHERE id = ?',
      toNotebookId,
      sortOrder,
      row.id,
    );
    touchedDates.add(row.date);
  }
  for (const date of touchedDates) {
    await renumberChapters(db, toNotebookId, date);
  }
}

/** Delete one chapter and close the gap it leaves in the day's numbering. */
export async function deleteJournal(db: SQLiteDatabase, id: string): Promise<void> {
  const existing = await db.getFirstAsync<{ notebook_id: string; date: string }>(
    'SELECT notebook_id, date FROM daily_journals WHERE id = ?',
    id,
  );
  await db.runAsync('DELETE FROM daily_journals WHERE id = ?', id);
  if (existing) {
    await renumberChapters(db, existing.notebook_id, existing.date);
  }
}

export async function deleteJournalsForNotebook(
  db: SQLiteDatabase,
  notebookId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM daily_journals WHERE notebook_id = ?', notebookId);
}

export async function deleteAllJournals(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM daily_journals');
}

export async function deleteJournalsBeforeDate(
  db: SQLiteDatabase,
  beforeDate: string,
): Promise<void> {
  await db.runAsync('DELETE FROM daily_journals WHERE date < ?', beforeDate);
}
