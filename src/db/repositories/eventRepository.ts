import type { SQLiteDatabase } from 'expo-sqlite';
import type { LifeEvent } from '../../protocol';
import { PROTOCOL_VERSION } from '../../protocol';

/** SQLite access for append-only life events. Prefer batch helpers when loading many elements. */

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

export async function getEventsForElementSince(
  db: SQLiteDatabase,
  elementId: string,
  sinceDate: string,
): Promise<LifeEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM events WHERE element_id = ? AND date >= ? ORDER BY date ASC, timestamp ASC',
    elementId,
    sinceDate,
  );
  return rows.map(rowToEvent);
}

function groupEventsByElement(rows: EventRow[]): Map<string, LifeEvent[]> {
  const byElement = new Map<string, LifeEvent[]>();
  for (const row of rows) {
    const event = rowToEvent(row);
    const list = byElement.get(event.elementId) ?? [];
    list.push(event);
    byElement.set(event.elementId, list);
  }
  return byElement;
}

export async function getEventsForElementsOnDate(
  db: SQLiteDatabase,
  elementIds: string[],
  date: string,
): Promise<Map<string, LifeEvent[]>> {
  if (elementIds.length === 0) return new Map();

  const placeholders = elementIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM events WHERE date = ? AND element_id IN (${placeholders}) ORDER BY timestamp ASC`,
    date,
    ...elementIds,
  );
  const byElement = groupEventsByElement(rows);
  for (const id of elementIds) {
    if (!byElement.has(id)) {
      byElement.set(id, []);
    }
  }
  return byElement;
}

export async function getEventsForElementsSince(
  db: SQLiteDatabase,
  elementIds: string[],
  sinceDate: string,
): Promise<Map<string, LifeEvent[]>> {
  if (elementIds.length === 0) return new Map();

  const placeholders = elementIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM events WHERE date >= ? AND element_id IN (${placeholders}) ORDER BY date ASC, timestamp ASC`,
    sinceDate,
    ...elementIds,
  );
  const byElement = groupEventsByElement(rows);
  for (const id of elementIds) {
    if (!byElement.has(id)) {
      byElement.set(id, []);
    }
  }
  return byElement;
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

export async function getAllEvents(db: SQLiteDatabase): Promise<LifeEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM events ORDER BY timestamp ASC',
  );
  return rows.map(rowToEvent);
}
