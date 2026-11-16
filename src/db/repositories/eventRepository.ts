import type { SQLiteDatabase } from 'expo-sqlite';
import type { HabitConfig, LifeEvent } from '../../protocol';
import {
  EventSchema,
  isHabitDayComplete,
  isSkipEvent,
  PROTOCOL_VERSION,
  skipEventPayload,
} from '../../protocol';
import { withImmediateTransaction } from '../immediateTransaction';

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

/**
 * True for a "skip today" row (`meta.source = 'skip'`). Guarded by json_valid so
 * one corrupt meta string cannot fail a whole aggregate. Kotlin writes the same
 * JSON, so this is the one place SQL recognises a skip.
 */
const IS_SKIP_ROW_SQL =
  "(CASE WHEN json_valid(meta_json) THEN json_extract(meta_json, '$.source') END) = 'skip'";

async function deleteEventsById(db: SQLiteDatabase, events: readonly LifeEvent[]): Promise<void> {
  for (const event of events) {
    await db.runAsync('DELETE FROM events WHERE id = ?', event.id);
  }
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
): Promise<{ date: string; total: number; skipped: boolean }[]> {
  const rows = await db.getAllAsync<{ date: string; total: number; skipped: number }>(
    `SELECT date, COALESCE(SUM(value), 0) as total,
       MAX(CASE WHEN ${IS_SKIP_ROW_SQL} THEN 1 ELSE 0 END) as skipped
     FROM events
     WHERE element_id = ? AND date >= ?
     GROUP BY date
     ORDER BY date ASC`,
    elementId,
    sinceDate,
  );
  return rows.map((row) => ({ date: row.date, total: row.total, skipped: row.skipped === 1 }));
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

/** The id, time and meta for an event a write may add; the rest comes from the write. */
export interface NewEventStub {
  id: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

/**
 * Collapse a day to one event of `total` (none at 0). Call inside a transaction.
 * A skip row is not a quantity, so it survives the collapse untouched: it is
 * neither dropped nor duplicated (whether the day still *reads* as skipped is
 * the day rules' call — a day that reaches its target is complete, not skipped).
 */
async function collapseDayToTotal(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
  total: number,
  newEvent: NewEventStub,
): Promise<void> {
  // In SQL rather than by parsed id, so a row with corrupt meta is still cleared.
  await db.runAsync(
    `DELETE FROM events WHERE element_id = ? AND date = ? AND NOT COALESCE(${IS_SKIP_ROW_SQL}, 0)`,
    elementId,
    date,
  );
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
}

/**
 * Replace a day's events for one element with a single total, atomically.
 * The one same-day "replace" flow the protocol rules call out — never used
 * to rewrite a past day's history.
 *
 * Reads the day inside the same write transaction: if SQLite already holds
 * `total` (another writer got there first) nothing is rewritten. Resolves to
 * the day's total as committed.
 */
export async function setDailyTotalForElement(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
  total: number,
  newEvent: NewEventStub,
): Promise<number> {
  return withImmediateTransaction(db, async () => {
    if ((await getDailyTotal(db, elementId, date)) === total) return total;
    await collapseDayToTotal(db, elementId, date, total, newEvent);
    return total;
  });
}

/**
 * Move a day's total by `delta` from whatever SQLite holds now — counter Undo.
 * Relative rather than "restore to N" so a +1 another writer (the home-screen
 * widget) logged after the taps being undone survives the undo. Clamps at 0.
 * Resolves to the day's total as committed.
 */
export async function adjustDailyTotalForElement(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
  delta: number,
  newEvent: NewEventStub,
): Promise<number> {
  return withImmediateTransaction(db, async () => {
    const current = await getDailyTotal(db, elementId, date);
    const next = Math.max(0, current + delta);
    if (next === current) return current;
    await collapseDayToTotal(db, elementId, date, next, newEvent);
    return next;
  });
}

/** A habit day as SQLite holds it after a write — what the UI reconciles to. */
export interface HabitDayAfterWrite {
  done: boolean;
  total: number;
  events: LifeEvent[];
  /** False when the day already matched the intent and nothing was written. */
  changed: boolean;
}

/**
 * Make a boolean habit's day match what the user asked for, atomically.
 *
 * `done` is the user's intent — the state they tapped toward, derived from what
 * the screen showed — not "flip whatever SQLite says". Inside one IMMEDIATE
 * transaction the day is read, then:
 * - intent done, day not done → append one tick event, and delete the day's
 *   skip row if it has one (ticking a skipped day un-skips it);
 * - intent not done, day done → delete the day's events, skip rows included:
 *   an untick returns the day to plain "not done", never to "skipped";
 * - day already matches the intent → write nothing.
 * So a tick racing another writer's tick yields one event, and an untick of a
 * day someone else already cleared is a quiet no-op.
 */
export async function applyHabitDayIntent(
  db: SQLiteDatabase,
  input: {
    elementId: string;
    date: string;
    done: boolean;
    config: HabitConfig;
    newEvent: NewEventStub;
  },
): Promise<HabitDayAfterWrite> {
  const { elementId, date, done, config, newEvent } = input;
  return withImmediateTransaction(db, async () => {
    const events = await getEventsForElementOnDate(db, elementId, date);
    const total = events.reduce((sum, event) => sum + event.value, 0);
    const isDone = isHabitDayComplete(total, config, events);
    if (isDone === done) {
      return { done: isDone, total, events, changed: false };
    }
    if (!done) {
      await deleteEventsForElementOnDate(db, elementId, date);
      return { done: false, total: 0, events: [], changed: true };
    }
    const tick: LifeEvent = {
      id: newEvent.id,
      elementId,
      timestamp: newEvent.timestamp,
      date,
      value: 1,
      meta: newEvent.meta,
      protocolVersion: PROTOCOL_VERSION,
    };
    const skipRows = events.filter(isSkipEvent);
    await deleteEventsById(db, skipRows);
    await insertEvent(db, tick);
    const nextEvents = [...events.filter((event) => !isSkipEvent(event)), tick];
    const nextTotal = total + 1;
    return {
      done: isHabitDayComplete(nextTotal, config, nextEvents),
      total: nextTotal,
      events: nextEvents,
      changed: true,
    };
  });
}

/**
 * Delete a day's events for one element and resolve to exactly what was
 * deleted, in one transaction — so an Undo puts back everything the clear
 * removed, including a row another writer added a moment before.
 */
export async function takeEventsForElementOnDate(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
): Promise<LifeEvent[]> {
  return withImmediateTransaction(db, async () => {
    const events = await getEventsForElementOnDate(db, elementId, date);
    await deleteEventsForElementOnDate(db, elementId, date);
    return events;
  });
}

/**
 * Re-insert `events` only if nothing was *logged* on the day since, atomically.
 * A skip row alone is not a log: the restore still runs, but never adds a
 * second skip row to a day that already has one. Resolves to false (writing
 * nothing) when anything else was logged on that day since.
 */
export async function restoreEventsIfDayEmpty(
  db: SQLiteDatabase,
  elementId: string,
  date: string,
  events: readonly LifeEvent[],
): Promise<boolean> {
  return withImmediateTransaction(db, async () => {
    const current = await getEventsForElementOnDate(db, elementId, date);
    if (current.some((event) => !isSkipEvent(event))) return false;
    const alreadySkipped = current.length > 0;
    for (const event of events) {
      if (alreadySkipped && isSkipEvent(event)) continue;
      await insertEvent(db, event);
    }
    return true;
  });
}

/** A tracker day after a skip write — what the UI reconciles to. */
export interface SkipDayAfterWrite {
  /** The day reads as skipped: it holds a skip row and is not complete. */
  skipped: boolean;
  /** The day holds a skip row (it may also be complete, e.g. a widget tick). */
  hasSkipRow: boolean;
  total: number;
  /** False when the day already matched the intent (or is complete) and nothing was written. */
  changed: boolean;
}

/**
 * Skip or un-skip one tracker day, atomically (one IMMEDIATE transaction):
 * - skip: insert one value-0 `{ source: 'skip' }` row, unless the day is
 *   complete (nothing to skip) or already holds a skip row (at most one per day);
 * - unskip: delete only that day's skip rows; logged values stay.
 * `isComplete` is the tracker's completion rule over the day's total and rows.
 */
export async function applySkipDayIntent(
  db: SQLiteDatabase,
  input: {
    elementId: string;
    date: string;
    skip: boolean;
    isComplete: (total: number, events: readonly LifeEvent[]) => boolean;
    newEvent: Omit<NewEventStub, 'meta'>;
  },
): Promise<SkipDayAfterWrite> {
  const { elementId, date, skip, isComplete, newEvent } = input;
  return withImmediateTransaction(db, async () => {
    const events = await getEventsForElementOnDate(db, elementId, date);
    const total = events.reduce((sum, event) => sum + event.value, 0);
    const complete = isComplete(total, events);
    const skipRows = events.filter(isSkipEvent);
    if (skip) {
      if (complete || skipRows.length > 0) {
        const hasSkipRow = skipRows.length > 0;
        return { skipped: !complete && hasSkipRow, hasSkipRow, total, changed: false };
      }
      await insertEvent(db, {
        id: newEvent.id,
        elementId,
        timestamp: newEvent.timestamp,
        date,
        ...skipEventPayload(),
        protocolVersion: PROTOCOL_VERSION,
      });
      return { skipped: true, hasSkipRow: true, total, changed: true };
    }
    if (skipRows.length === 0) {
      return { skipped: false, hasSkipRow: false, total, changed: false };
    }
    await deleteEventsById(db, skipRows);
    return { skipped: false, hasSkipRow: false, total, changed: true };
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

/** One element's day: SUM(value), and whether it holds a skip row (value 0, invisible to SUM). */
export interface DayTotalState {
  total: number;
  skipped: boolean;
}

/** Today's total and skip flag per element, in one query (Home day state). */
export async function getDayStatesForElementsOnDate(
  db: SQLiteDatabase,
  elementIds: string[],
  date: string,
): Promise<Map<string, DayTotalState>> {
  const states = new Map<string, DayTotalState>();
  for (const id of elementIds) {
    states.set(id, { total: 0, skipped: false });
  }
  if (elementIds.length === 0) return states;

  const rows = await db.getAllAsync<{ element_id: string; total: number; skipped: number }>(
    `SELECT element_id, COALESCE(SUM(value), 0) as total,
       MAX(CASE WHEN ${IS_SKIP_ROW_SQL} THEN 1 ELSE 0 END) as skipped
     FROM events
     WHERE date = ? AND element_id IN (${placeholdersFor(elementIds)})
     GROUP BY element_id`,
    date,
    ...elementIds,
  );
  for (const row of rows) {
    states.set(row.element_id, { total: row.total, skipped: row.skipped === 1 });
  }
  return states;
}

/**
 * Daily SUM(value) per element since a date, with a skip flag per day — for
 * streaks and the strength score without loading every row.
 */
export async function getDailyTotalsForElementsSince(
  db: SQLiteDatabase,
  elementIds: string[],
  sinceDate: string,
): Promise<Map<string, { date: string; total: number; skipped: boolean }[]>> {
  const byElement = new Map<string, { date: string; total: number; skipped: boolean }[]>();
  for (const id of elementIds) {
    byElement.set(id, []);
  }
  if (elementIds.length === 0) return byElement;

  const rows = await db.getAllAsync<{
    element_id: string;
    date: string;
    total: number;
    skipped: number;
  }>(
    `SELECT element_id, date, COALESCE(SUM(value), 0) as total,
       MAX(CASE WHEN ${IS_SKIP_ROW_SQL} THEN 1 ELSE 0 END) as skipped
     FROM events
     WHERE date >= ? AND element_id IN (${placeholdersFor(elementIds)})
     GROUP BY element_id, date
     ORDER BY date ASC`,
    sinceDate,
    ...elementIds,
  );
  for (const row of rows) {
    byElement
      .get(row.element_id)
      ?.push({ date: row.date, total: row.total, skipped: row.skipped === 1 });
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
