/**
 * SQLite access for ambient calendar (not Life Protocol kinds).
 * UI goes through `calendarStore`; backup/import call these helpers directly.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  CalendarEventSchema,
  CalendarOccurrenceClearSchema,
  CalendarReminderSchema,
  CalendarSchema,
  type Calendar,
  type CalendarEvent,
  type CalendarOccurrenceClear,
  type CalendarReminder,
} from '../../calendar/types';
import { DEFAULT_CALENDAR_COLOR, DEFAULT_CALENDAR_NAME } from '../../calendar/defaults';
import { newId } from '../../utils/id';

interface CalendarRow {
  id: string;
  name: string;
  color: string;
  source: string;
}

interface EventRow {
  id: string;
  calendar_id: string;
  uid: string;
  title: string;
  notes: string | null;
  event_type: string;
  all_day: number;
  start_at: string;
  end_at: string;
  timezone: string;
  rrule: string | null;
}

interface ReminderRow {
  id: string;
  event_id: string;
  offset_minutes: number;
  enabled: number;
}

function rowToCalendar(row: CalendarRow): Calendar {
  return CalendarSchema.parse({
    id: row.id,
    name: row.name,
    color: row.color,
    source: row.source,
  });
}

function rowToEvent(row: EventRow): CalendarEvent {
  return CalendarEventSchema.parse({
    id: row.id,
    calendarId: row.calendar_id,
    uid: row.uid,
    title: row.title,
    notes: row.notes,
    eventType: row.event_type,
    allDay: row.all_day === 1,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    rrule: row.rrule,
  });
}

function rowToReminder(row: ReminderRow): CalendarReminder {
  return CalendarReminderSchema.parse({
    id: row.id,
    eventId: row.event_id,
    offsetMinutes: row.offset_minutes,
    enabled: row.enabled === 1,
  });
}

export async function getAllCalendars(db: SQLiteDatabase): Promise<Calendar[]> {
  const rows = await db.getAllAsync<CalendarRow>(
    'SELECT id, name, color, source FROM calendars ORDER BY name COLLATE NOCASE',
  );
  return rows.map(rowToCalendar);
}

export async function insertCalendar(db: SQLiteDatabase, calendar: Calendar): Promise<void> {
  const parsed = CalendarSchema.parse(calendar);
  await db.runAsync(
    'INSERT INTO calendars (id, name, color, source) VALUES (?, ?, ?, ?)',
    parsed.id,
    parsed.name,
    parsed.color,
    parsed.source,
  );
}

export async function ensureDefaultCalendar(db: SQLiteDatabase): Promise<Calendar> {
  const existing = await getAllCalendars(db);
  if (existing[0]) return existing[0];

  const calendar: Calendar = {
    id: newId(),
    name: DEFAULT_CALENDAR_NAME,
    color: DEFAULT_CALENDAR_COLOR,
    source: 'local',
  };
  await insertCalendar(db, calendar);
  return calendar;
}

export async function getAllEvents(db: SQLiteDatabase): Promise<CalendarEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    `SELECT id, calendar_id, uid, title, notes, event_type, all_day,
            start_at, end_at, timezone, rrule
     FROM calendar_events
     ORDER BY start_at ASC`,
  );
  return rows.map(rowToEvent);
}

export async function insertEvent(db: SQLiteDatabase, event: CalendarEvent): Promise<void> {
  const parsed = CalendarEventSchema.parse(event);
  await db.runAsync(
    `INSERT INTO calendar_events (
      id, calendar_id, uid, title, notes, event_type, all_day,
      start_at, end_at, timezone, rrule
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.calendarId,
    parsed.uid,
    parsed.title,
    parsed.notes,
    parsed.eventType,
    parsed.allDay ? 1 : 0,
    parsed.startAt,
    parsed.endAt,
    parsed.timezone,
    parsed.rrule,
  );
}

export async function updateEvent(db: SQLiteDatabase, event: CalendarEvent): Promise<void> {
  const parsed = CalendarEventSchema.parse(event);
  await db.runAsync(
    `UPDATE calendar_events SET
      calendar_id = ?, uid = ?, title = ?, notes = ?, event_type = ?, all_day = ?,
      start_at = ?, end_at = ?, timezone = ?, rrule = ?
     WHERE id = ?`,
    parsed.calendarId,
    parsed.uid,
    parsed.title,
    parsed.notes,
    parsed.eventType,
    parsed.allDay ? 1 : 0,
    parsed.startAt,
    parsed.endAt,
    parsed.timezone,
    parsed.rrule,
    parsed.id,
  );
}

export async function deleteEvent(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM calendar_events WHERE id = ?', id);
}

export async function getAllReminders(db: SQLiteDatabase): Promise<CalendarReminder[]> {
  const rows = await db.getAllAsync<ReminderRow>(
    'SELECT id, event_id, offset_minutes, enabled FROM calendar_reminders',
  );
  return rows.map(rowToReminder);
}

async function insertReminder(
  db: SQLiteDatabase,
  reminder: CalendarReminder,
): Promise<void> {
  const parsed = CalendarReminderSchema.parse(reminder);
  await db.runAsync(
    `INSERT INTO calendar_reminders (id, event_id, offset_minutes, enabled)
     VALUES (?, ?, ?, ?)`,
    parsed.id,
    parsed.eventId,
    parsed.offsetMinutes,
    parsed.enabled ? 1 : 0,
  );
}

/** Replace all reminders for an event. Caller must already be inside a transaction when needed. */
async function replaceRemindersForEvent(
  db: SQLiteDatabase,
  eventId: string,
  reminders: CalendarReminder[],
): Promise<void> {
  await db.runAsync('DELETE FROM calendar_reminders WHERE event_id = ?', eventId);
  for (const reminder of reminders) {
    await insertReminder(db, { ...reminder, eventId });
  }
}

/** Insert event + reminders atomically. */
export async function insertEventWithReminders(
  db: SQLiteDatabase,
  event: CalendarEvent,
  reminders: CalendarReminder[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await insertEvent(db, event);
    await replaceRemindersForEvent(db, event.id, reminders);
  });
}

/** Update event + replace reminders atomically. */
export async function updateEventWithReminders(
  db: SQLiteDatabase,
  event: CalendarEvent,
  reminders: CalendarReminder[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await updateEvent(db, event);
    await replaceRemindersForEvent(db, event.id, reminders);
  });
}

export async function clearCalendarData(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM calendar_occurrence_clears');
  await db.runAsync('DELETE FROM calendar_reminders');
  await db.runAsync('DELETE FROM calendar_events');
  await db.runAsync('DELETE FROM calendars');
}

export async function getAllOccurrenceClears(
  db: SQLiteDatabase,
): Promise<CalendarOccurrenceClear[]> {
  const rows = await db.getAllAsync<{
    occurrence_key: string;
    event_id: string;
    cleared_at: string;
  }>('SELECT occurrence_key, event_id, cleared_at FROM calendar_occurrence_clears');
  return rows.map((row) =>
    CalendarOccurrenceClearSchema.parse({
      occurrenceKey: row.occurrence_key,
      eventId: row.event_id,
      clearedAt: row.cleared_at,
    }),
  );
}

export async function upsertOccurrenceClear(
  db: SQLiteDatabase,
  clear: CalendarOccurrenceClear,
): Promise<void> {
  const parsed = CalendarOccurrenceClearSchema.parse(clear);
  await db.runAsync(
    `INSERT INTO calendar_occurrence_clears (occurrence_key, event_id, cleared_at)
     VALUES (?, ?, ?)
     ON CONFLICT(occurrence_key) DO UPDATE SET
       event_id = excluded.event_id,
       cleared_at = excluded.cleared_at`,
    parsed.occurrenceKey,
    parsed.eventId,
    parsed.clearedAt,
  );
}

export async function deleteOccurrenceClear(
  db: SQLiteDatabase,
  occurrenceKey: string,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM calendar_occurrence_clears WHERE occurrence_key = ?',
    occurrenceKey,
  );
}

export async function deleteOccurrenceClearsForEvent(
  db: SQLiteDatabase,
  eventId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM calendar_occurrence_clears WHERE event_id = ?', eventId);
}

export async function importCalendarData(
  db: SQLiteDatabase,
  data: {
    calendars: Calendar[];
    events: CalendarEvent[];
    reminders: CalendarReminder[];
    clearedOccurrences?: CalendarOccurrenceClear[];
  },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const calendar of data.calendars) {
      await insertCalendar(db, calendar);
    }
    for (const event of data.events) {
      await insertEvent(db, event);
    }
    for (const reminder of data.reminders) {
      await insertReminder(db, reminder);
    }
    for (const clear of data.clearedOccurrences ?? []) {
      await upsertOccurrenceClear(db, clear);
    }
  });
}
