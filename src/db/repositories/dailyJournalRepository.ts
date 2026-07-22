import type { SQLiteDatabase } from 'expo-sqlite';
import type { DailyJournal } from '../../protocol';
import {
  DAILY_JOURNAL_BODY_MAX_LENGTH,
  DailyJournalSchema,
  PROTOCOL_VERSION,
} from '../../protocol';
import { newId } from '../../utils/id';

interface DailyJournalRow {
  id: string;
  date: string;
  body: string;
  updated_at: string;
  protocol_version: number;
}

function rowToJournal(row: DailyJournalRow): DailyJournal {
  return DailyJournalSchema.parse({
    id: row.id,
    date: row.date,
    body: row.body,
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

export async function getJournal(
  db: SQLiteDatabase,
  date: string,
): Promise<DailyJournal | null> {
  const row = await db.getFirstAsync<DailyJournalRow>(
    'SELECT * FROM daily_journals WHERE date = ?',
    date,
  );
  return row ? tryRowToJournal(row) : null;
}

export async function getAllJournals(db: SQLiteDatabase): Promise<DailyJournal[]> {
  const rows = await db.getAllAsync<DailyJournalRow>(
    'SELECT * FROM daily_journals ORDER BY date DESC, updated_at DESC',
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
    `INSERT INTO daily_journals (id, date, body, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.date,
    parsed.body,
    parsed.updatedAt,
    parsed.protocolVersion,
  );
}

/**
 * Upsert journal for `date`. Whitespace-only body deletes the row.
 * Returns the saved journal, or null when cleared.
 */
export async function upsertJournal(
  db: SQLiteDatabase,
  input: { date: string; body: string },
): Promise<DailyJournal | null> {
  const trimmed = input.body.trim();
  if (trimmed.length === 0) {
    await deleteJournalForDate(db, input.date);
    return null;
  }
  if (trimmed.length > DAILY_JOURNAL_BODY_MAX_LENGTH) {
    throw new Error(`Journal must be at most ${DAILY_JOURNAL_BODY_MAX_LENGTH} characters`);
  }

  const existing = await getJournal(db, input.date);
  const journal = DailyJournalSchema.parse({
    id: existing?.id ?? newId(),
    date: input.date,
    body: trimmed,
    updatedAt: new Date().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
  });

  await db.runAsync(
    `INSERT INTO daily_journals (id, date, body, updated_at, protocol_version)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       id = excluded.id,
       body = excluded.body,
       updated_at = excluded.updated_at,
       protocol_version = excluded.protocol_version`,
    journal.id,
    journal.date,
    journal.body,
    journal.updatedAt,
    journal.protocolVersion,
  );

  return getJournal(db, input.date);
}

export async function deleteJournalForDate(
  db: SQLiteDatabase,
  date: string,
): Promise<void> {
  await db.runAsync('DELETE FROM daily_journals WHERE date = ?', date);
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
