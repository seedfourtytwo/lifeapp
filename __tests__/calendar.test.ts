import {
  expandOccurrences,
  occurrencesOnDay,
} from '../src/calendar/occurrences';
import { parseRrule, recurrenceToRrule, weekdayFromDate } from '../src/calendar/rrule';
import { addLocalMonths, parseDateOnlyLocal, toLocalOffsetIso } from '../src/calendar/dates';
import type { Calendar, CalendarEvent } from '../src/calendar/types';
import { CalendarEventSchema, withoutClearedOccurrences } from '../src/calendar/types';

const calendar: Calendar = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Personal',
  color: '#3D7EA6',
  source: 'local',
};

function allDayEvent(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'startAt' | 'endAt'>): CalendarEvent {
  return CalendarEventSchema.parse({
    calendarId: calendar.id,
    uid: `uid-${partial.id}`,
    notes: null,
    eventType: 'general',
    allDay: true,
    timezone: 'Europe/Berlin',
    rrule: null,
    ...partial,
  });
}

describe('rrule helpers', () => {
  it('round-trips weekly BYDAY', () => {
    const rule = parseRrule('FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(rule.freq).toBe('weekly');
    expect(rule.byWeekDays).toEqual(['MO', 'WE', 'FR']);
    expect(recurrenceToRrule(rule)).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('treats empty rrule as none', () => {
    expect(parseRrule(null).freq).toBe('none');
    expect(recurrenceToRrule({ freq: 'none', interval: 1, byWeekDays: [] })).toBeNull();
  });

  it('maps JS weekday to RRULE weekday', () => {
    // 2026-07-20 is a Monday
    expect(weekdayFromDate(new Date(2026, 6, 20))).toBe('MO');
  });
});

describe('expandOccurrences', () => {
  const calendars = new Map([[calendar.id, calendar]]);

  it('includes a one-off all-day event on its day', () => {
    const event = allDayEvent({
      id: '550e8400-e29b-41d4-a716-446655440010',
      title: 'Dentist',
      startAt: '2026-07-20',
      endAt: '2026-07-20',
    });
    const rangeStart = new Date(2026, 6, 1);
    const rangeEnd = new Date(2026, 7, 1);
    const occ = expandOccurrences([event], calendars, rangeStart, rangeEnd);
    expect(occ).toHaveLength(1);
    expect(occ[0]?.title).toBe('Dentist');
    expect(occurrencesOnDay(occ, new Date(2026, 6, 20))).toHaveLength(1);
    expect(occurrencesOnDay(occ, new Date(2026, 6, 21))).toHaveLength(0);
  });

  it('expands yearly birthdays', () => {
    const event = allDayEvent({
      id: '550e8400-e29b-41d4-a716-446655440011',
      title: 'Alex Bday',
      eventType: 'birthday',
      startAt: '2020-03-15',
      endAt: '2020-03-15',
      rrule: 'FREQ=YEARLY',
    });
    const rangeStart = new Date(2026, 0, 1);
    const rangeEnd = new Date(2028, 0, 1);
    const occ = expandOccurrences([event], calendars, rangeStart, rangeEnd);
    expect(occ.map((o) => o.start.getFullYear())).toEqual([2026, 2027]);
    expect(occ.every((o) => o.start.getMonth() === 2 && o.start.getDate() === 15)).toBe(true);
  });

  it('expands monthly on the same day-of-month', () => {
    const event = allDayEvent({
      id: '550e8400-e29b-41d4-a716-446655440012',
      title: 'Rent',
      startAt: '2026-01-15',
      endAt: '2026-01-15',
      rrule: 'FREQ=MONTHLY',
    });
    const rangeStart = new Date(2026, 0, 1);
    const rangeEnd = new Date(2026, 4, 1);
    const occ = expandOccurrences([event], calendars, rangeStart, rangeEnd);
    expect(occ).toHaveLength(4);
    expect(occ.map((o) => o.start.getMonth())).toEqual([0, 1, 2, 3]);
  });

  it('clamps monthly day for short months', () => {
    const jan31 = new Date(2026, 0, 31, 10, 0, 0);
    const feb = addLocalMonths(jan31, 1);
    expect(feb.getMonth()).toBe(1);
    expect(feb.getDate()).toBe(28);
  });

  it('expands weekly on selected weekdays', () => {
    const event = allDayEvent({
      id: '550e8400-e29b-41d4-a716-446655440013',
      title: 'Gym',
      startAt: '2026-07-20', // Monday
      endAt: '2026-07-20',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    });
    const rangeStart = new Date(2026, 6, 20);
    const rangeEnd = new Date(2026, 6, 27);
    const occ = expandOccurrences([event], calendars, rangeStart, rangeEnd);
    expect(occ.map((o) => o.start.getDate())).toEqual([20, 22]);
  });

  it('expands timed events with duration', () => {
    const start = new Date(2026, 6, 20, 15, 0, 0);
    const end = new Date(2026, 6, 20, 16, 0, 0);
    const event = CalendarEventSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440014',
      calendarId: calendar.id,
      uid: 'uid-timed',
      title: 'Call',
      notes: null,
      eventType: 'appointment',
      allDay: false,
      startAt: toLocalOffsetIso(start),
      endAt: toLocalOffsetIso(end),
      timezone: 'Europe/Berlin',
      rrule: null,
    });
    const occ = expandOccurrences(
      [event],
      calendars,
      new Date(2026, 6, 20),
      new Date(2026, 6, 21),
    );
    expect(occ).toHaveLength(1);
    expect(occ[0]?.allDay).toBe(false);
    expect(occ[0]?.end.getTime() - occ[0]!.start.getTime()).toBe(60 * 60 * 1000);
  });

  it('parses date-only strings as local midnight', () => {
    const d = parseDateOnlyLocal('2026-07-20');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
  });
});

describe('withoutClearedOccurrences', () => {
  it('filters only the cleared occurrence key', () => {
    const base = {
      eventId: '550e8400-e29b-41d4-a716-446655440010',
      calendarId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'X',
      notes: null,
      eventType: 'general' as const,
      allDay: true,
      start: new Date(2026, 6, 20),
      end: new Date(2026, 6, 21),
      color: '#3D7EA6',
      rrule: null,
    };
    const a = { ...base, occurrenceKey: 'a:2026-07-20' };
    const b = { ...base, occurrenceKey: 'b:2026-07-20', title: 'Y' };
    const filtered = withoutClearedOccurrences([a, b], new Set(['a:2026-07-20']));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.occurrenceKey).toBe('b:2026-07-20');
  });
});
