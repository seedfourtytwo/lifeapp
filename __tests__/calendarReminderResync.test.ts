/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
/**
 * Calendar reminders re-synced against a scheduler that remembers what is
 * pending: a sync with nothing changed must leave it alone.
 */
import { CalendarEventSchema, type Calendar, type CalendarReminder } from '../src/calendar/types';
import type { FakeNotifications } from './support/fakeNotifications';

jest.mock('expo-notifications', () =>
  require('./support/fakeNotifications').createFakeNotifications(),
);

type CalendarReminders = typeof import('../src/notifications/calendarReminders.native');

const calendar: Calendar = {
  id: '550e8400-e29b-41d4-a716-446655440981',
  name: 'Personal',
  color: '#3D7EA6',
  source: 'local',
};
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440982';
const NOW = new Date('2026-11-11T09:00:00.000Z');

function input(title = 'Dentist', offsets: number[] = [10, 60]) {
  const start = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
  const event = CalendarEventSchema.parse({
    id: EVENT_ID,
    calendarId: calendar.id,
    uid: 'uid-dentist',
    title,
    notes: null,
    eventType: 'general',
    allDay: false,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3600_000).toISOString(),
    timezone: 'Europe/Paris',
    rrule: null,
  });
  const reminders: CalendarReminder[] = offsets.map((offsetMinutes, i) => ({
    id: `550e8400-e29b-41d4-a716-44665544099${i}`,
    eventId: EVENT_ID,
    offsetMinutes,
    enabled: true,
  }));
  return { events: [event], calendars: [calendar], reminders };
}

let calendarReminders: CalendarReminders;
let fake: FakeNotifications;

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  calendarReminders = require('../src/notifications/calendarReminders.native');
  fake = require('expo-notifications');
});

afterEach(() => {
  jest.useRealTimers();
});

it('a second identical sync schedules and cancels nothing', async () => {
  await calendarReminders.syncCalendarReminders(input());
  expect(fake.pending.size).toBe(2);
  fake.scheduleNotificationAsync.mockClear();
  fake.cancelScheduledNotificationAsync.mockClear();

  await calendarReminders.syncCalendarReminders(input());

  expect(fake.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(fake.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(fake.pending.size).toBe(2);
});

it('re-schedules a renamed event and cancels a removed reminder', async () => {
  await calendarReminders.syncCalendarReminders(input());
  fake.scheduleNotificationAsync.mockClear();

  await calendarReminders.syncCalendarReminders(input('Dentist, Dr Roux', [10]));

  expect(fake.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(fake.scheduledList().map((r) => r.content.body)).toEqual(['Dentist, Dr Roux in 10 min']);
});
