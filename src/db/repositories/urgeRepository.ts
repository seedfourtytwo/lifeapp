import type { SQLiteDatabase } from 'expo-sqlite';
import { UrgeOutcomeSchema, UrgeSchema, type Urge, type UrgeInput, type UrgeOutcome } from '../../protocol/urge';

interface UrgeRow {
  id: string;
  at: string;
  day: string;
  outcome: string | null;
  resolved_at: string | null;
  source: string;
  note: string | null;
}

/** Rows that fail validation are skipped, like every other repository's. */
function collect(rows: UrgeRow[]): Urge[] {
  const urges: Urge[] = [];
  for (const row of rows) {
    const parsed = UrgeSchema.safeParse({
      id: row.id,
      at: row.at,
      day: row.day,
      outcome: row.outcome,
      resolvedAt: row.resolved_at,
      source: row.source,
      note: row.note,
    });
    if (parsed.success) urges.push(parsed.data);
    else console.warn(`Skipping unreadable urge ${row.id}`);
  }
  return urges;
}

/** Inserts the urge unless one with its id is there already: logging it twice adds one. */
export async function insertUrge(db: SQLiteDatabase, input: UrgeInput): Promise<void> {
  const urge = UrgeSchema.parse(input);
  await db.runAsync(
    `INSERT OR IGNORE INTO urges (id, at, day, outcome, resolved_at, source, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    urge.id,
    urge.at,
    urge.day,
    urge.outcome,
    urge.resolvedAt,
    urge.source,
    urge.note,
  );
}

/** Sets or clears what led to the urge. */
export async function setUrgeNote(db: SQLiteDatabase, id: string, note: string | null): Promise<void> {
  await db.runAsync('UPDATE urges SET note = ? WHERE id = ?', note, id);
}

/** How the urge ended: null while open, or when there is no such urge. */
export async function getUrgeOutcome(db: SQLiteDatabase, id: string): Promise<UrgeOutcome | null> {
  const row = await db.getFirstAsync<{ outcome: string | null }>('SELECT outcome FROM urges WHERE id = ?', id);
  const parsed = UrgeOutcomeSchema.safeParse(row?.outcome);
  return parsed.success ? parsed.data : null;
}

/** Resolves an open urge; one already resolved keeps its first outcome. */
export async function resolveUrge(
  db: SQLiteDatabase,
  id: string,
  outcome: UrgeOutcome,
  resolvedAt: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE urges SET outcome = ?, resolved_at = ? WHERE id = ? AND outcome IS NULL',
    outcome,
    resolvedAt,
    id,
  );
}

export async function urgeExists(db: SQLiteDatabase, id: string): Promise<boolean> {
  return (await db.getFirstAsync('SELECT 1 FROM urges WHERE id = ?', id)) !== null;
}

/** Open urges, oldest first. */
export async function getOpenUrges(db: SQLiteDatabase): Promise<Urge[]> {
  return collect(
    await db.getAllAsync<UrgeRow>('SELECT * FROM urges WHERE outcome IS NULL ORDER BY at ASC'),
  );
}

export async function countRiddenOut(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM urges WHERE outcome = 'rode_out'",
  );
  return row?.n ?? 0;
}

export async function countUrgesOnDay(db: SQLiteDatabase, day: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM urges WHERE day = ?',
    day,
  );
  return row?.n ?? 0;
}

/** Everything, for backup export. */
export async function getAllUrges(db: SQLiteDatabase): Promise<Urge[]> {
  return collect(await db.getAllAsync<UrgeRow>('SELECT * FROM urges ORDER BY at ASC'));
}

export async function deleteAllUrges(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM urges');
}

/** `before` is an exclusive `YYYY-MM-DD` cut-off on the day an urge was logged. */
export async function deleteUrgesBeforeDate(db: SQLiteDatabase, before: string): Promise<void> {
  await db.runAsync('DELETE FROM urges WHERE day < ?', before);
}
