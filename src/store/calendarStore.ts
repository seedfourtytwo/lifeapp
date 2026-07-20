import { create } from 'zustand';
import { defaultReminderOffsets } from '../calendar/defaults';
import {
  deviceTimeZone,
  toLocalOffsetIso,
  defaultTimedEnd,
  toDateString,
} from '../calendar/dates';
import { expandOccurrences } from '../calendar/occurrences';
import { recurrenceToRrule } from '../calendar/rrule';
import type {
  Calendar,
  CalendarEvent,
  CalendarEventType,
  CalendarOccurrence,
  CalendarOccurrenceClear,
  CalendarReminder,
  RecurrenceRule,
} from '../calendar/types';
import { withoutClearedOccurrences } from '../calendar/types';
import { getDatabase } from '../db/client';
import * as calendarRepo from '../db/repositories/calendarRepository';
import { newId } from '../utils/id';

export interface CalendarEventInput {
  title: string;
  notes: string | null;
  eventType: CalendarEventType;
  allDay: boolean;
  /** Local date/time selection from the editor. */
  start: Date;
  end: Date;
  recurrence: RecurrenceRule;
  reminderOffsets: number[];
  calendarId?: string;
}

/**
 * Calendar UI mirror of SQLite.
 * Local notification schedules are owned by `useCalendarReminderSync` (not this store)
 * so mutations only update DB + state; the hook reacts to those state changes.
 */
interface CalendarState {
  calendars: Calendar[];
  events: CalendarEvent[];
  reminders: CalendarReminder[];
  /** occurrenceKey → clear record */
  clearedByKey: Record<string, CalendarOccurrenceClear>;
  isLoaded: boolean;
  load: () => Promise<void>;
  createEvent: (input: CalendarEventInput) => Promise<string>;
  updateEvent: (eventId: string, input: CalendarEventInput) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  /** Silence this occurrence only (badge + notifications). */
  clearOccurrence: (occurrence: Pick<CalendarOccurrence, 'occurrenceKey' | 'eventId'>) => Promise<void>;
  /** Undo silence for this occurrence. */
  unclearedOccurrence: (occurrenceKey: string) => Promise<void>;
  isOccurrenceCleared: (occurrenceKey: string) => boolean;
  /** Expanded instances in [rangeStart, rangeEnd) — includes cleared (month view). */
  occurrencesInRange: (rangeStart: Date, rangeEnd: Date) => CalendarOccurrence[];
  /** Upcoming attention list (badge / peek) — excludes cleared occurrences. */
  attentionOccurrences: (limit?: number, withinDays?: number) => CalendarOccurrence[];
}

function calendarsMap(calendars: Calendar[]): Map<string, Calendar> {
  return new Map(calendars.map((c) => [c.id, c]));
}

function clearedKeySet(clearedByKey: Record<string, CalendarOccurrenceClear>): Set<string> {
  return new Set(Object.keys(clearedByKey));
}

function serializeEventTimes(
  allDay: boolean,
  start: Date,
  end: Date,
): { startAt: string; endAt: string } {
  if (allDay) {
    const startAt = toDateString(start);
    let endAt = toDateString(end);
    if (endAt < startAt) endAt = startAt;
    return { startAt, endAt };
  }
  const startAt = toLocalOffsetIso(start);
  let endAt = toLocalOffsetIso(end);
  if (end.getTime() <= start.getTime()) {
    endAt = toLocalOffsetIso(defaultTimedEnd(start));
  }
  return { startAt, endAt };
}

function buildReminderRows(eventId: string, offsets: number[]): CalendarReminder[] {
  const unique = [...new Set(offsets.filter((n) => Number.isFinite(n) && n >= 0))].sort(
    (a, b) => b - a,
  );
  return unique.map((offsetMinutes) => ({
    id: newId(),
    eventId,
    offsetMinutes,
    enabled: true,
  }));
}

function clearsToRecord(clears: CalendarOccurrenceClear[]): Record<string, CalendarOccurrenceClear> {
  const record: Record<string, CalendarOccurrenceClear> = {};
  for (const clear of clears) {
    record[clear.occurrenceKey] = clear;
  }
  return record;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendars: [],
  events: [],
  reminders: [],
  clearedByKey: {},
  isLoaded: false,

  load: async () => {
    try {
      const db = await getDatabase();
      await calendarRepo.ensureDefaultCalendar(db);
      const [calendars, events, reminders, clears] = await Promise.all([
        calendarRepo.getAllCalendars(db),
        calendarRepo.getAllEvents(db),
        calendarRepo.getAllReminders(db),
        calendarRepo.getAllOccurrenceClears(db),
      ]);
      set({
        calendars,
        events,
        reminders,
        clearedByKey: clearsToRecord(clears),
        isLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load calendar', error);
      set({ isLoaded: true });
    }
  },

  createEvent: async (input) => {
    const db = await getDatabase();
    const calendar =
      (input.calendarId
        ? get().calendars.find((c) => c.id === input.calendarId)
        : get().calendars[0]) ?? (await calendarRepo.ensureDefaultCalendar(db));

    const { startAt, endAt } = serializeEventTimes(input.allDay, input.start, input.end);
    const event: CalendarEvent = {
      id: newId(),
      calendarId: calendar.id,
      uid: `${newId()}@lifeapp.local`,
      title: input.title.trim(),
      notes: input.notes?.trim() ? input.notes.trim() : null,
      eventType: input.eventType,
      allDay: input.allDay,
      startAt,
      endAt,
      timezone: deviceTimeZone(),
      rrule: recurrenceToRrule(input.recurrence),
    };
    const reminders = buildReminderRows(event.id, input.reminderOffsets);

    await calendarRepo.insertEventWithReminders(db, event, reminders);

    const events = [...get().events, event];
    const allReminders = [
      ...get().reminders.filter((r) => r.eventId !== event.id),
      ...reminders,
    ];
    const calendars = get().calendars.some((c) => c.id === calendar.id)
      ? get().calendars
      : [...get().calendars, calendar];

    set({ events, reminders: allReminders, calendars });
    return event.id;
  },

  updateEvent: async (eventId, input) => {
    const existing = get().events.find((e) => e.id === eventId);
    if (!existing) throw new Error('Event not found');

    const db = await getDatabase();
    const calendarId = input.calendarId ?? existing.calendarId;
    const { startAt, endAt } = serializeEventTimes(input.allDay, input.start, input.end);

    const event: CalendarEvent = {
      ...existing,
      calendarId,
      title: input.title.trim(),
      notes: input.notes?.trim() ? input.notes.trim() : null,
      eventType: input.eventType,
      allDay: input.allDay,
      startAt,
      endAt,
      timezone: existing.timezone || deviceTimeZone(),
      rrule: recurrenceToRrule(input.recurrence),
    };
    const reminders = buildReminderRows(event.id, input.reminderOffsets);

    await calendarRepo.updateEventWithReminders(db, event, reminders);

    const events = get().events.map((e) => (e.id === eventId ? event : e));
    const allReminders = [
      ...get().reminders.filter((r) => r.eventId !== eventId),
      ...reminders,
    ];
    set({ events, reminders: allReminders });
  },

  deleteEvent: async (eventId) => {
    const db = await getDatabase();
    await calendarRepo.deleteEvent(db, eventId);
    const events = get().events.filter((e) => e.id !== eventId);
    const reminders = get().reminders.filter((r) => r.eventId !== eventId);
    const clearedByKey = { ...get().clearedByKey };
    for (const key of Object.keys(clearedByKey)) {
      if (clearedByKey[key]?.eventId === eventId) delete clearedByKey[key];
    }
    set({ events, reminders, clearedByKey });
  },

  clearOccurrence: async (occurrence) => {
    const clear: CalendarOccurrenceClear = {
      occurrenceKey: occurrence.occurrenceKey,
      eventId: occurrence.eventId,
      clearedAt: new Date().toISOString(),
    };
    const db = await getDatabase();
    await calendarRepo.upsertOccurrenceClear(db, clear);
    set({ clearedByKey: { ...get().clearedByKey, [clear.occurrenceKey]: clear } });
  },

  unclearedOccurrence: async (occurrenceKey) => {
    const db = await getDatabase();
    await calendarRepo.deleteOccurrenceClear(db, occurrenceKey);
    const clearedByKey = { ...get().clearedByKey };
    delete clearedByKey[occurrenceKey];
    set({ clearedByKey });
  },

  isOccurrenceCleared: (occurrenceKey) => get().clearedByKey[occurrenceKey] != null,

  occurrencesInRange: (rangeStart, rangeEnd) =>
    expandOccurrences(get().events, calendarsMap(get().calendars), rangeStart, rangeEnd),

  attentionOccurrences: (limit = 20, withinDays = 90) => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + withinDays);
    const all = expandOccurrences(get().events, calendarsMap(get().calendars), now, end);
    return withoutClearedOccurrences(all, clearedKeySet(get().clearedByKey)).slice(0, limit);
  },
}));

export function suggestedRemindersFor(allDay: boolean): number[] {
  return defaultReminderOffsets(allDay);
}
