import type { Calendar, CalendarEvent, CalendarOccurrence, Weekday } from './types';
import {
  addLocalDays,
  addLocalMonths,
  addLocalYears,
  parseDateOnlyLocal,
  startOfLocalDay,
  toDateString,
} from './dates';
import { parseRrule, weekdayFromDate } from './rrule';

/**
 * Expand stored events into concrete occurrences for a time window.
 * Cleared occurrences are filtered by callers (store `attentionOccurrences` / UI month view).
 */

const MAX_OCCURRENCES_PER_EVENT = 400;

function eventDurationMs(event: CalendarEvent): number {
  if (event.allDay) {
    const start = parseDateOnlyLocal(event.startAt);
    const endInclusive = parseDateOnlyLocal(event.endAt);
    const endExclusive = addLocalDays(endInclusive, 1);
    return Math.max(endExclusive.getTime() - start.getTime(), 86_400_000);
  }
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return Math.max(end.getTime() - start.getTime(), 60_000);
}

function seriesAnchor(event: CalendarEvent): Date {
  if (event.allDay) {
    return startOfLocalDay(parseDateOnlyLocal(event.startAt));
  }
  return new Date(event.startAt);
}

function toOccurrence(
  event: CalendarEvent,
  calendar: Calendar,
  anchorStart: Date,
  durationMs: number,
): CalendarOccurrence {
  const keyDate = event.allDay
    ? toDateString(anchorStart)
    : `${toDateString(anchorStart)}T${String(anchorStart.getHours()).padStart(2, '0')}:${String(anchorStart.getMinutes()).padStart(2, '0')}`;
  return {
    eventId: event.id,
    calendarId: event.calendarId,
    title: event.title,
    notes: event.notes,
    eventType: event.eventType,
    allDay: event.allDay,
    start: anchorStart,
    end: new Date(anchorStart.getTime() + durationMs),
    occurrenceKey: `${event.id}:${keyDate}`,
    color: calendar.color,
    rrule: event.rrule,
  };
}

function overlapsRange(
  start: Date,
  end: Date,
  rangeStartMs: number,
  rangeEndMs: number,
): boolean {
  return end.getTime() > rangeStartMs && start.getTime() < rangeEndMs;
}

function expandDaily(
  event: CalendarEvent,
  calendar: Calendar,
  anchor: Date,
  durationMs: number,
  interval: number,
  rangeStartMs: number,
  rangeEndMs: number,
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = [];
  let cursor = new Date(anchor);

  if (cursor.getTime() < rangeStartMs) {
    const daysBehind = Math.floor((rangeStartMs - cursor.getTime()) / 86_400_000);
    const steps = Math.floor(daysBehind / interval) * interval;
    cursor = addLocalDays(anchor, steps);
    if (cursor.getTime() > rangeStartMs) {
      cursor = addLocalDays(cursor, -interval);
    }
    if (cursor.getTime() < anchor.getTime()) {
      cursor = new Date(anchor);
    }
  }

  let guard = 0;
  while (guard < MAX_OCCURRENCES_PER_EVENT) {
    guard += 1;
    const end = new Date(cursor.getTime() + durationMs);
    if (cursor.getTime() >= rangeEndMs) break;
    if (cursor.getTime() >= anchor.getTime() && overlapsRange(cursor, end, rangeStartMs, rangeEndMs)) {
      out.push(toOccurrence(event, calendar, new Date(cursor), durationMs));
    }
    cursor = addLocalDays(cursor, interval);
  }
  return out;
}

function localCalendarDayDiff(later: Date, earlier: Date): number {
  const a = startOfLocalDay(later);
  const b = startOfLocalDay(earlier);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86_400_000);
}

function expandWeekly(
  event: CalendarEvent,
  calendar: Calendar,
  anchor: Date,
  durationMs: number,
  interval: number,
  weekDays: Weekday[],
  rangeStartMs: number,
  rangeEndMs: number,
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = [];
  const anchorDay = startOfLocalDay(anchor);
  // Jump near the requested window so old series (years of history) still expand.
  let cursor = startOfLocalDay(new Date(rangeStartMs));
  cursor = addLocalDays(cursor, -Math.ceil(durationMs / 86_400_000));
  if (cursor.getTime() < anchorDay.getTime()) {
    cursor = new Date(anchorDay);
  }

  let guard = 0;
  while (guard < MAX_OCCURRENCES_PER_EVENT) {
    guard += 1;
    const start = event.allDay
      ? startOfLocalDay(cursor)
      : new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          anchor.getHours(),
          anchor.getMinutes(),
          anchor.getSeconds(),
          anchor.getMilliseconds(),
        );
    const end = new Date(start.getTime() + durationMs);
    if (start.getTime() >= rangeEndMs) break;

    if (start.getTime() >= anchor.getTime() && weekDays.includes(weekdayFromDate(start))) {
      const weekIndex = Math.floor(localCalendarDayDiff(start, anchorDay) / 7);
      if (weekIndex >= 0 && weekIndex % interval === 0 && overlapsRange(start, end, rangeStartMs, rangeEndMs)) {
        out.push(toOccurrence(event, calendar, start, durationMs));
      }
    }
    cursor = addLocalDays(cursor, 1);
  }
  return out;
}

function expandMonthly(
  event: CalendarEvent,
  calendar: Calendar,
  anchor: Date,
  durationMs: number,
  interval: number,
  rangeStartMs: number,
  rangeEndMs: number,
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = [];
  let index = 0;
  if (anchor.getTime() < rangeStartMs) {
    const rangeStart = new Date(rangeStartMs);
    const monthsBehind =
      (rangeStart.getFullYear() - anchor.getFullYear()) * 12 +
      (rangeStart.getMonth() - anchor.getMonth());
    index = Math.max(0, Math.floor(monthsBehind / interval) - 1);
  }

  let guard = 0;
  while (guard < MAX_OCCURRENCES_PER_EVENT) {
    guard += 1;
    const cursor = addLocalMonths(anchor, index * interval);
    index += 1;
    const end = new Date(cursor.getTime() + durationMs);
    if (cursor.getTime() >= rangeEndMs) break;
    if (overlapsRange(cursor, end, rangeStartMs, rangeEndMs)) {
      out.push(toOccurrence(event, calendar, cursor, durationMs));
    }
  }
  return out;
}

function expandYearly(
  event: CalendarEvent,
  calendar: Calendar,
  anchor: Date,
  durationMs: number,
  interval: number,
  rangeStartMs: number,
  rangeEndMs: number,
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = [];
  let index = 0;
  if (anchor.getTime() < rangeStartMs) {
    const rangeStart = new Date(rangeStartMs);
    const yearsBehind = rangeStart.getFullYear() - anchor.getFullYear();
    index = Math.max(0, Math.floor(yearsBehind / interval) - 1);
  }

  let guard = 0;
  while (guard < MAX_OCCURRENCES_PER_EVENT) {
    guard += 1;
    const cursor = addLocalYears(anchor, index * interval);
    index += 1;
    const end = new Date(cursor.getTime() + durationMs);
    if (cursor.getTime() >= rangeEndMs) break;
    if (overlapsRange(cursor, end, rangeStartMs, rangeEndMs)) {
      out.push(toOccurrence(event, calendar, cursor, durationMs));
    }
  }
  return out;
}

/**
 * Expand events into occurrences overlapping [rangeStart, rangeEnd).
 * Uses device-local calendar arithmetic (offline-friendly, no TZ DB).
 */
export function expandOccurrences(
  events: CalendarEvent[],
  calendarsById: Map<string, Calendar>,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarOccurrence[] {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const results: CalendarOccurrence[] = [];

  for (const event of events) {
    const calendar = calendarsById.get(event.calendarId);
    if (!calendar) continue;

    const rule = parseRrule(event.rrule);
    const anchor = seriesAnchor(event);
    const durationMs = eventDurationMs(event);

    if (rule.freq === 'none') {
      const end = new Date(anchor.getTime() + durationMs);
      if (overlapsRange(anchor, end, rangeStartMs, rangeEndMs)) {
        results.push(toOccurrence(event, calendar, anchor, durationMs));
      }
      continue;
    }

    if (rule.freq === 'daily') {
      results.push(
        ...expandDaily(event, calendar, anchor, durationMs, rule.interval, rangeStartMs, rangeEndMs),
      );
    } else if (rule.freq === 'weekly') {
      const weekDays =
        rule.byWeekDays.length > 0 ? rule.byWeekDays : [weekdayFromDate(anchor)];
      results.push(
        ...expandWeekly(
          event,
          calendar,
          anchor,
          durationMs,
          rule.interval,
          weekDays,
          rangeStartMs,
          rangeEndMs,
        ),
      );
    } else if (rule.freq === 'monthly') {
      results.push(
        ...expandMonthly(
          event,
          calendar,
          anchor,
          durationMs,
          rule.interval,
          rangeStartMs,
          rangeEndMs,
        ),
      );
    } else if (rule.freq === 'yearly') {
      results.push(
        ...expandYearly(
          event,
          calendar,
          anchor,
          durationMs,
          rule.interval,
          rangeStartMs,
          rangeEndMs,
        ),
      );
    }
  }

  results.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
  return results;
}

/** Occurrences that fall on a local calendar day (inclusive). */
export function occurrencesOnDay(
  occurrences: CalendarOccurrence[],
  day: Date,
): CalendarOccurrence[] {
  const dayStart = startOfLocalDay(day);
  const dayEnd = addLocalDays(dayStart, 1);
  return occurrences.filter((occ) => overlapsRange(occ.start, occ.end, dayStart.getTime(), dayEnd.getTime()));
}
