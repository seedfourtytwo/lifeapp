import type { SQLiteDatabase } from 'expo-sqlite';
import type { DayFacts, LifeEvent } from '../../protocol';
import { EventSchema, factsFromTotal, PROTOCOL_VERSION } from '../../protocol';

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

/** A row's meta, or NULL when it is not valid JSON — so json_extract never throws on it. */
const VALID_META = `CASE WHEN json_valid(meta_json) THEN meta_json END`;

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

/** Remove specific events of one element — Undo of the taps it just logged. */
export async function deleteEventsByIds(
  db: SQLiteDatabase,
  elementId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.runAsync(
    `DELETE FROM events WHERE element_id = ? AND id IN (${placeholdersFor(ids)})`,
    elementId,
    ...ids,
  );
}

/** Undo of Done on a timed habit: the day's markers go, its timer sessions stay. */
export async function deleteManualCompleteMarkers(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<void> {
  await db.runAsync(
    `DELETE FROM events
     WHERE element_id = ? AND date = ?
       AND json_extract(${VALID_META}, '$.source') = 'manual_complete'`,
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

/** `?, ?, ?` for an `IN (...)` clause. Ids are always bound, never interpolated. */
function placeholdersFor(ids: readonly string[]): string {
  return ids.map(() => '?').join(', ');
}

export async function eventExists(db: SQLiteDatabase, id: string): Promise<boolean> {
  return (await db.getFirstAsync('SELECT 1 FROM events WHERE id = ?', id)) !== null;
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

/**
 * The facts `dayOutcome` needs, per element per day, straight from SQL — the
 * same answer `dayFactsFromEvents` gives, without loading a row per event. A
 * meta that is not valid JSON counts towards the total and nothing else,
 * rather than failing the whole query.
 */
const DAY_FACTS_COLUMNS = `
  COALESCE(SUM(value), 0) AS total,
  MAX(json_extract(${VALID_META}, '$.source') = 'timer_session'
      AND json_extract(${VALID_META}, '$.trackCompleted') = 1) AS track_completed,
  MAX(json_extract(${VALID_META}, '$.source') = 'manual_complete') AS marked_complete,
  (SELECT json_extract(g.meta_json, '$.goalSeconds')
     FROM events g
    WHERE g.element_id = events.element_id AND g.date = events.date
      AND json_valid(g.meta_json)
      AND json_extract(g.meta_json, '$.source') = 'timer_session'
      AND json_type(g.meta_json, '$.goalSeconds') IN ('integer', 'real')
    ORDER BY g.timestamp DESC
    LIMIT 1) AS goal_seconds`;

interface DayFactsRow {
  element_id: string;
  date: string;
  total: number;
  /** NULL when no event that day had JSON meta. */
  track_completed: number | null;
  marked_complete: number | null;
  goal_seconds: number | null;
}

function rowToDayFacts(row: DayFactsRow): DayFacts {
  return {
    total: row.total,
    trackCompleted: row.track_completed === 1,
    markedComplete: row.marked_complete === 1,
    ...(row.goal_seconds === null ? {} : { goalSeconds: row.goal_seconds }),
  };
}

export async function getDayFactsForElementsOnDate(
  db: SQLiteDatabase,
  elementIds: readonly string[],
  date: string,
): Promise<Map<string, DayFacts>> {
  const byElement = new Map<string, DayFacts>();
  for (const id of elementIds) byElement.set(id, factsFromTotal(0));
  if (elementIds.length === 0) return byElement;

  const rows = await db.getAllAsync<DayFactsRow>(
    `SELECT element_id, date, ${DAY_FACTS_COLUMNS}
     FROM events
     WHERE date = ? AND element_id IN (${placeholdersFor(elementIds)})
     GROUP BY element_id`,
    date,
    ...elementIds,
  );
  for (const row of rows) byElement.set(row.element_id, rowToDayFacts(row));
  return byElement;
}

/** Every logged day from `sinceDate` on, oldest first, per element. */
export async function getDayFactsForElementsSince(
  db: SQLiteDatabase,
  elementIds: readonly string[],
  sinceDate: string,
): Promise<Map<string, { date: string; facts: DayFacts }[]>> {
  const byElement = new Map<string, { date: string; facts: DayFacts }[]>();
  for (const id of elementIds) byElement.set(id, []);
  if (elementIds.length === 0) return byElement;

  const rows = await db.getAllAsync<DayFactsRow>(
    `SELECT element_id, date, ${DAY_FACTS_COLUMNS}
     FROM events
     WHERE date >= ? AND element_id IN (${placeholdersFor(elementIds)})
     GROUP BY element_id, date
     ORDER BY date ASC`,
    sinceDate,
    ...elementIds,
  );
  for (const row of rows) {
    byElement.get(row.element_id)?.push({ date: row.date, facts: rowToDayFacts(row) });
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
