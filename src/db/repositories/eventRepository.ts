import type { SQLiteDatabase } from 'expo-sqlite';
import type { LifeEvent } from '../../protocol';
import { EventSchema, PROTOCOL_VERSION } from '../../protocol';

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
  return EventSchema.parse({
    id: row.id,
    elementId: row.element_id,
    timestamp: row.timestamp,
    date: row.date,
    value: row.value,
    meta: row.meta_json ? (JSON.parse(row.meta_json) as Record<string, unknown>) : undefined,
    protocolVersion: PROTOCOL_VERSION,
  });
}

/** Skip and log corrupt rows rather than let one bad event break every daily total that includes it. */
function mapRowsToEvents(rows: EventRow[]): LifeEvent[] {
  const events: LifeEvent[] = [];
  for (const row of rows) {
    try {
      events.push(rowToEvent(row));
    } catch (error) {
      console.warn(
        `Skipping corrupt event ${row.id} (element ${row.element_id}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return events;
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
  return mapRowsToEvents(rows);
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
  return mapRowsToEvents(rows);
}

/** `?, ?, ?` for an `IN (...)` clause. Ids are always bound, never interpolated. */
function placeholdersFor(ids: readonly string[]): string {
  return ids.map(() => '?').join(', ');
}

/**
 * Group rows by element, seeding every requested id so callers can read the
 * map without a `?? []` at each use.
 */
function groupEventsByElement(
  rows: EventRow[],
  elementIds: readonly string[],
): Map<string, LifeEvent[]> {
  const byElement = new Map<string, LifeEvent[]>();
  for (const id of elementIds) {
    byElement.set(id, []);
  }
  for (const event of mapRowsToEvents(rows)) {
    byElement.get(event.elementId)?.push(event);
  }
  return byElement;
}

export async function getEventsForElementsOnDate(
  db: SQLiteDatabase,
  elementIds: string[],
  date: string,
): Promise<Map<string, LifeEvent[]>> {
  if (elementIds.length === 0) return new Map();

  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM events WHERE date = ? AND element_id IN (${placeholdersFor(elementIds)}) ORDER BY timestamp ASC`,
    date,
    ...elementIds,
  );
  return groupEventsByElement(rows, elementIds);
}

export async function getEventsForElementsSince(
  db: SQLiteDatabase,
  elementIds: string[],
  sinceDate: string,
): Promise<Map<string, LifeEvent[]>> {
  if (elementIds.length === 0) return new Map();

  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM events WHERE date >= ? AND element_id IN (${placeholdersFor(elementIds)}) ORDER BY date ASC, timestamp ASC`,
    sinceDate,
    ...elementIds,
  );
  return groupEventsByElement(rows, elementIds);
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
  EventSchema.parse(event);

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

/**
 * Replace today's events for one element with a single total, atomically.
 * The one same-day "replace" flow the protocol rules call out — never used
 * to rewrite a past day's history.
 */
export async function setDailyTotalForElement(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
  total: number,
  newEvent: { id: string; timestamp: string; meta?: Record<string, unknown> },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await deleteEventsForElementOnDate(db, elementId, date);
    if (total > 0) {
      await insertEvent(db, {
        id: newEvent.id,
        elementId,
        timestamp: newEvent.timestamp,
        date,
        value: total,
        meta: newEvent.meta,
        protocolVersion: PROTOCOL_VERSION,
      });
    }
  });
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

export async function getDailyTotalsForElementsOnDate(
  db: SQLiteDatabase,
  elementIds: string[],
  date: string,
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  for (const id of elementIds) {
    totals.set(id, 0);
  }
  if (elementIds.length === 0) return totals;

  const rows = await db.getAllAsync<{ element_id: string; total: number }>(
    `SELECT element_id, COALESCE(SUM(value), 0) as total
     FROM events
     WHERE date = ? AND element_id IN (${placeholdersFor(elementIds)})
     GROUP BY element_id`,
    date,
    ...elementIds,
  );
  for (const row of rows) {
    totals.set(row.element_id, row.total);
  }
  return totals;
}

/** Daily SUM(value) per element since a date — for streak completion without loading every row. */
export async function getDailyTotalsForElementsSince(
  db: SQLiteDatabase,
  elementIds: string[],
  sinceDate: string,
): Promise<Map<string, { date: string; total: number }[]>> {
  const byElement = new Map<string, { date: string; total: number }[]>();
  for (const id of elementIds) {
    byElement.set(id, []);
  }
  if (elementIds.length === 0) return byElement;

  const rows = await db.getAllAsync<{ element_id: string; date: string; total: number }>(
    `SELECT element_id, date, COALESCE(SUM(value), 0) as total
     FROM events
     WHERE date >= ? AND element_id IN (${placeholdersFor(elementIds)})
     GROUP BY element_id, date
     ORDER BY date ASC`,
    sinceDate,
    ...elementIds,
  );
  for (const row of rows) {
    byElement.get(row.element_id)?.push({ date: row.date, total: row.total });
  }
  return byElement;
}

export async function getAllEvents(db: SQLiteDatabase): Promise<LifeEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM events ORDER BY timestamp ASC',
  );
  return mapRowsToEvents(rows);
}

/** Wipe every protocol event (activity history). */
export async function deleteAllEvents(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM events');
}

/** Delete activity with local `date` strictly before `beforeDate` (YYYY-MM-DD). */
export async function deleteEventsBeforeDate(
  db: SQLiteDatabase,
  beforeDate: string,
): Promise<void> {
  await db.runAsync('DELETE FROM events WHERE date < ?', beforeDate);
}
