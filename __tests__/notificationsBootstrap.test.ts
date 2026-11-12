/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import type { FakeNotifications } from './support/fakeNotifications';

jest.mock('expo-notifications', () =>
  require('./support/fakeNotifications').createFakeNotifications(),
);

type Bootstrap = typeof import('../src/notifications/notificationsBootstrap.native');

let bootstrap: Bootstrap;
let fake: FakeNotifications;

beforeEach(() => {
  jest.resetModules();
  bootstrap = require('../src/notifications/notificationsBootstrap.native');
  fake = require('expo-notifications');
});

it('loads the notifications module once and sets the foreground handler once', async () => {
  const first = await bootstrap.getNotifications();
  const second = await bootstrap.getNotifications();

  expect(first).not.toBeNull();
  expect(second).toBe(first);
  expect(fake.setNotificationHandler).toHaveBeenCalledTimes(1);
});

it('cancels only the pending notifications whose identifier has the prefix', async () => {
  const notifications = (await bootstrap.getNotifications())!;
  for (const identifier of ['habit-reminder-a', 'habit-reminder-eod', 'cal-reminder-b']) {
    await fake.scheduleNotificationAsync({ identifier, content: {}, trigger: { type: 'date' } });
  }

  await bootstrap.cancelScheduledWithPrefix(notifications, 'habit-reminder-', {
    keep: (id) => id === 'habit-reminder-eod',
  });

  expect([...fake.pending.keys()].sort()).toEqual(['cal-reminder-b', 'habit-reminder-eod']);
});

it('is the one availability check both reminder modules use', () => {
  const habit = require('../src/notifications/habitReminders.native');
  const calendar = require('../src/notifications/calendarReminders.native');

  expect(habit.isNotificationsNativeAvailable).toBe(bootstrap.isNotificationsNativeAvailable);
  expect(calendar.isNotificationsNativeAvailable).toBe(bootstrap.isNotificationsNativeAvailable);
});

describe('reminders channel', () => {
  it('creates a high-importance Reminders channel before any permission prompt', async () => {
    fake.state.permission = require('./support/fakeNotifications').permission('undetermined');

    await bootstrap.requestNotificationPermissions();

    expect(fake.channels.get(bootstrap.REMINDERS_CHANNEL_ID)).toEqual(
      expect.objectContaining({ name: 'Reminders', importance: fake.AndroidImportance.HIGH }),
    );
    const created = fake.setNotificationChannelAsync.mock.invocationCallOrder[0];
    const asked = fake.requestPermissionsAsync.mock.invocationCallOrder[0];
    expect(created).toBeLessThan(asked!);
  });

  it('creates the channel once per process', async () => {
    await bootstrap.getNotifications();
    await bootstrap.getNotifications();

    expect(fake.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
  });

  it('sends the evening and calendar reminders on that channel', async () => {
    const habit = require('../src/notifications/habitReminders.native');
    const calendar = require('../src/notifications/calendarReminders.native');
    await habit.scheduleEndOfDayReminder(true, '20:00');
    const eventId = '550e8400-e29b-41d4-a716-446655440701';
    const calendarId = '550e8400-e29b-41d4-a716-446655440702';
    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await calendar.syncCalendarReminders({
      events: [
        {
          id: eventId,
          calendarId,
          uid: 'uid-1',
          title: 'Dentist',
          notes: null,
          eventType: 'general',
          allDay: false,
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 3600_000).toISOString(),
          timezone: 'Europe/Paris',
          rrule: null,
        },
      ],
      calendars: [{ id: calendarId, name: 'Personal', color: '#3D7EA6', source: 'local' }],
      reminders: [{ id: '550e8400-e29b-41d4-a716-446655440703', eventId, offsetMinutes: 10, enabled: true }],
    });

    const prefixes = fake.scheduledList().map((r) => r.identifier.split('-')[0]);
    expect(new Set(prefixes)).toEqual(new Set(['habit', 'cal']));
    expect(fake.scheduledList().some((r) => r.identifier === 'habit-reminder-eod')).toBe(true);
    for (const request of fake.scheduledList()) {
      expect(request.trigger.channelId).toBe(bootstrap.REMINDERS_CHANNEL_ID);
    }
  });
});
