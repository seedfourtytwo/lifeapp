import type { SQLiteDatabase } from 'expo-sqlite';
import type { LifeEvent } from '../../protocol';
import { PROTOCOL_VERSION } from '../../protocol';

interface EventRow {
  id: string;
  element_id: string;
  timestamp: string;
  date: string;
  value: number;
  meta_json: string | null;
  protocol_version: number;
}

function rowToEvent(row: EventRow): LifeEvent {
  return {
    id: row.id,
    elementId: row.element_id,
    timestamp: row.timestamp,
    date: row.date,
    value: row.value,
    meta: row.meta_json ? (JSON.parse(row.meta_json) as Record<string, unknown>) : undefined,
    protocolVersion: PROTOCOL_VERSION,
  };
}

export async function deleteEventById(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM events WHERE id = ?', id);
}

export async function getLastEventForElementOnDate(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<LifeEvent | null> {
  const row = await db.getFirstAsync<EventRow>(
    `SELECT * FROM events WHERE element_id = ? AND date = ?
     ORDER BY timestamp DESC LIMIT 1`,
    elementId,
    date,
  );
  return row ? rowToEvent(row) : null;
}

export async function deleteEventsForElementOnDate(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM events WHERE element_id = ? AND date = ?',
    elementId,
    date,
  );
}

export async function getDailyTotalsByElement(
  db: SQLiteDatabase,
  elementId: string,
  sinceDate: string,
): Promise<{ date: string; total: number }[]> {
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT date, COALESCE(SUM(value), 0) as total
     FROM events
     WHERE element_id = ? AND date >= ?
     GROUP BY date
     ORDER BY date ASC`,
    elementId,
    sinceDate,
  );
  return rows;
}

export async function getCompletedElementIdsOnDate(
  db: SQLiteDatabase,
  elementIds: string[],
  date: string,
): Promise<Set<string>> {
  if (elementIds.length === 0) return new Set();

  const placeholders = elementIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ element_id: string }>(
    `SELECT DISTINCT element_id FROM events
     WHERE date = ? AND element_id IN (${placeholders}) AND value >= 1`,
    date,
    ...elementIds,
  );
  return new Set(rows.map((r) => r.element_id));
}

export async function insertEvent(db: SQLiteDatabase, event: LifeEvent): Promise<void> {
  await db.runAsync(
    `INSERT INTO events (id, element_id, timestamp, date, value, meta_json, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    event.id,
    event.elementId,
    event.timestamp,
    event.date,
    event.value,
    event.meta ? JSON.stringify(event.meta) : null,
    event.protocolVersion,
  );
}

export async function getDailyTotal(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT COALESCE(SUM(value), 0) as total FROM events WHERE element_id = ? AND date = ?',
    elementId,
    date,
  );
  return row?.total ?? 0;
}

export async function getEventsForElementOnDate(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<LifeEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM events WHERE element_id = ? AND date = ? ORDER BY timestamp ASC',
    elementId,
    date,
  );
  return rows.map(rowToEvent);
}

export async function getAllEvents(db: SQLiteDatabase): Promise<LifeEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM events ORDER BY timestamp ASC',
  );
  return rows.map(rowToEvent);
}

export async function deleteAllEvents(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM events');
}
