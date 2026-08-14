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
  created_at: string;
  updated_at: string;
  protocol_version: number;
}

function rowToJournal(row: DailyJournalRow): DailyJournal {
  return DailyJournalSchema.parse({
    id: row.id,
    notebookId: row.notebook_id,
    date: row.date,
    body: row.body,
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

export async function getJournalForNotebookOnDate(
  db: SQLiteDatabase,
  notebookId: string,
  date: string,
): Promise<DailyJournal | null> {
  const row = await db.getFirstAsync<DailyJournalRow>(
    `SELECT * FROM daily_journals
     WHERE notebook_id = ? AND date = ?
     ORDER BY created_at DESC, updated_at DESC
     LIMIT 1`,
    notebookId,
    date,
  );
  return row ? tryRowToJournal(row) : null;
}

export async function getNotebookIdsWithJournalsOnDate(
  db: SQLiteDatabase,
  date: string,
): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ notebook_id: string }>(
    `SELECT DISTINCT notebook_id FROM daily_journals
     WHERE date = ? AND length(trim(body)) > 0`,
    date,
  );
  return new Set(rows.map((row) => row.notebook_id));
}

export async function getAllJournals(db: SQLiteDatabase): Promise<DailyJournal[]> {
  const rows = await db.getAllAsync<DailyJournalRow>(
    'SELECT * FROM daily_journals ORDER BY date DESC, created_at DESC, updated_at DESC',
  );
  return mapRows(rows);
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
      (id, notebook_id, date, body, created_at, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.notebookId,
    parsed.date,
    parsed.body,
    parsed.createdAt,
    parsed.updatedAt,
    parsed.protocolVersion,
  );
}

/**
 * Insert or update the day's document for a notebook.
 * Whitespace-only body deletes that row. Returns the saved journal, or null when cleared.
 */
export async function upsertJournal(
  db: SQLiteDatabase,
  input: { id?: string; notebookId: string; date: string; body: string },
): Promise<DailyJournal | null> {
  const trimmed = input.body.trim();
  const existing =
    (input.id ? await getJournalById(db, input.id) : null) ??
    (await getJournalForNotebookOnDate(db, input.notebookId, input.date));
  if (trimmed.length === 0) {
    await db.runAsync(
      'DELETE FROM daily_journals WHERE notebook_id = ? AND date = ?',
      input.notebookId,
      input.date,
    );
    if (input.id) {
      await db.runAsync('DELETE FROM daily_journals WHERE id = ?', input.id);
    }
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
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    protocolVersion: PROTOCOL_VERSION,
  });

  await db.runAsync(
    `INSERT INTO daily_journals
      (id, notebook_id, date, body, created_at, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       body = excluded.body,
       updated_at = excluded.updated_at,
       protocol_version = excluded.protocol_version`,
    journal.id,
    journal.notebookId,
    journal.date,
    journal.body,
    journal.createdAt,
    journal.updatedAt,
    journal.protocolVersion,
  );

  return getJournalById(db, journal.id);
}

export async function reassignJournalsToNotebook(
  db: SQLiteDatabase,
  fromNotebookId: string,
  toNotebookId: string,
): Promise<void> {
  if (fromNotebookId === toNotebookId) return;
  const fromRows = await db.getAllAsync<DailyJournalRow>(
    'SELECT * FROM daily_journals WHERE notebook_id = ?',
    fromNotebookId,
  );
  for (const row of fromRows) {
    const dest = await db.getFirstAsync<DailyJournalRow>(
      `SELECT * FROM daily_journals
       WHERE notebook_id = ? AND date = ?`,
      toNotebookId,
      row.date,
    );
    if (!dest) {
      await db.runAsync(
        'UPDATE daily_journals SET notebook_id = ? WHERE id = ?',
        toNotebookId,
        row.id,
      );
      continue;
    }
    const merged = joinJournalDayBodies([dest.body, row.body]);
    if (merged.trim().length === 0) {
      await db.runAsync(
        'DELETE FROM daily_journals WHERE id IN (?, ?)',
        dest.id,
        row.id,
      );
      continue;
    }
    await upsertJournal(db, {
      id: dest.id,
      notebookId: toNotebookId,
      date: row.date,
      body: merged,
    });
    await db.runAsync('DELETE FROM daily_journals WHERE id = ?', row.id);
  }
}

export async function deleteJournal(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM daily_journals WHERE id = ?', id);
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
