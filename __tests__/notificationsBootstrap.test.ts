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
