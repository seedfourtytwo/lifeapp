/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
/**
 * Habit reminders, scheduled by the real sync code against a scheduler that
 * remembers what is pending. Only expo-notifications is faked. Run in Chris's
 * zone, where the clocks change on the last Sundays of March and October.
 */
import type { ElementDefinition } from '../src/protocol';
import { permission, type FakeNotifications } from './support/fakeNotifications';
import { habitElement } from './support/elements';

jest.mock('expo-notifications', () =>
  require('./support/fakeNotifications').createFakeNotifications(),
);

type HabitReminders = typeof import('../src/notifications/habitReminders.native');

const previousTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Paris';
});
afterAll(() => {
  process.env.TZ = previousTz;
});

let reminders: HabitReminders;
let fake: FakeNotifications;

beforeEach(() => {
  jest.resetModules();
  reminders = require('../src/notifications/habitReminders.native');
  fake = require('expo-notifications');
});

const KEFIR = '550e8400-e29b-41d4-a716-446655440901';
const SPROUTS = '550e8400-e29b-41d4-a716-446655440902';

function habit(
  id: string,
  name: string,
  config: Record<string, unknown>,
  extra: Partial<ElementDefinition> = {},
): ElementDefinition {
  return {
    ...habitElement({
      id,
      name,
      createdAt: '2026-01-01T08:00:00.000Z',
      config: { trackingMode: 'boolean', schedule: { type: 'daily' }, ...config },
    }),
    ...extra,
  } as ElementDefinition;
}

const kefir = (extra: Partial<ElementDefinition> = {}) =>
  habit(KEFIR, 'Burp the kefir', { reminderTimes: ['09:00'] }, extra);
const sprouts = () => habit(SPROUTS, 'Rinse the sprouts', { reminderTimes: ['08:00', '20:00'] });

function local(fire: { trigger: { date?: Date | number } }): string {
  const date = new Date(fire.trigger.date!);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function firesFor(id: string): string[] {
  return fake
    .scheduledList()
    .filter((r) => r.identifier.startsWith(`habit-reminder-${id}-`))
    .map(local);
}

it('schedules each reminder time on every day of the next two weeks', async () => {
  const now = new Date(2026, 10, 11, 10, 0);

  await reminders.syncHabitReminders([sprouts()], true, {}, now);

  const fires = firesFor(SPROUTS);
  // 08:00 today has passed; 20:00 today, then both times for 13 more days.
  expect(fires).toHaveLength(1 + 13 * 2);
  expect(fires.slice(0, 3)).toEqual(['2026-11-11 20:00', '2026-11-12 08:00', '2026-11-12 20:00']);
  expect(fires.at(-1)).toBe('2026-11-24 20:00');
  for (const request of fake.scheduledList()) {
    expect(request.trigger).toEqual(
      expect.objectContaining({ type: 'date', channelId: 'reminders' }),
    );
    expect(request.content.body).toContain('Rinse the sprouts');
  }
});

it('names each reminder by habit, day and time so a re-sync replaces it', async () => {
  const now = new Date(2026, 10, 11, 10, 0);

  await reminders.syncHabitReminders([kefir()], true, {}, now);

  expect(fake.scheduledList()[0]!.identifier).toBe(`habit-reminder-${KEFIR}-2026-11-12-0900`);
});

it('puts a time just after midnight on the next calendar day', async () => {
  const lateEvening = new Date(2026, 10, 11, 23, 50);
  const nightOwl = habit(KEFIR, 'Burp the kefir', { reminderTimes: ['00:10', '23:55'] });

  await reminders.syncHabitReminders([nightOwl], true, {}, lateEvening);

  expect(firesFor(KEFIR).slice(0, 3)).toEqual([
    '2026-11-11 23:55',
    '2026-11-12 00:10',
    '2026-11-12 23:55',
  ]);
});

it('done today skips only what is left of today, even across midnight', async () => {
  const lateEvening = new Date(2026, 10, 11, 23, 50);
  const nightOwl = habit(KEFIR, 'Burp the kefir', { reminderTimes: ['00:10', '23:55'] });

  await reminders.syncHabitReminders([nightOwl, sprouts()], true, { [KEFIR]: true }, lateEvening);

  expect(firesFor(KEFIR)[0]).toBe('2026-11-12 00:10');
  expect(firesFor(SPROUTS)[0]).toBe('2026-11-12 08:00');
});

it('keeps the local clock time across the spring and autumn clock changes', async () => {
  const beforeSpring = new Date(2027, 2, 26, 12, 0);
  const morning = habit(KEFIR, 'Burp the kefir', { reminderTimes: ['08:00'] });

  await reminders.syncHabitReminders([morning], true, {}, beforeSpring);

  expect(firesFor(KEFIR).slice(0, 4)).toEqual([
    '2027-03-27 08:00',
    '2027-03-28 08:00',
    '2027-03-29 08:00',
    '2027-03-30 08:00',
  ]);
  const utcHours = fake.scheduledList().slice(0, 3).map((r) => new Date(r.trigger.date!).getUTCHours());
  expect(utcHours).toEqual([7, 6, 6]);

  jest.resetModules();
  reminders = require('../src/notifications/habitReminders.native');
  fake = require('expo-notifications');
  await reminders.syncHabitReminders([morning], true, {}, new Date(2026, 9, 24, 12, 0));
  expect(firesFor(KEFIR).slice(0, 2)).toEqual(['2026-10-25 08:00', '2026-10-26 08:00']);
});

it('fires once on the spring-forward night for a time the clock skips', async () => {
  const skipped = habit(KEFIR, 'Burp the kefir', { reminderTimes: ['02:30'] });

  await reminders.syncHabitReminders([skipped], true, {}, new Date(2027, 2, 27, 12, 0));

  // 02:30 does not exist on 28 March; the reminder comes as the clock reaches 03:30.
  expect(firesFor(KEFIR).slice(0, 2)).toEqual(['2027-03-28 03:30', '2027-03-29 02:30']);
});

it('follows an every-3-days schedule', async () => {
  const everyThird = habit(KEFIR, 'Burp the kefir', {
    reminderTimes: ['09:00'],
    schedule: { type: 'every_n_days', interval: 3, anchorDate: '2026-11-11' },
  });

  await reminders.syncHabitReminders([everyThird], true, {}, new Date(2026, 10, 11, 7, 0));

  expect(firesFor(KEFIR)).toEqual([
    '2026-11-11 09:00',
    '2026-11-14 09:00',
    '2026-11-17 09:00',
    '2026-11-20 09:00',
    '2026-11-23 09:00',
  ]);
});

it('follows a weekdays schedule', async () => {
  const weekdaysOnly = habit(KEFIR, 'Burp the kefir', {
    reminderTimes: ['09:00'],
    schedule: { type: 'weekdays', days: [1, 3] },
  });

  // Wednesday 11 November 2026.
  await reminders.syncHabitReminders([weekdaysOnly], true, {}, new Date(2026, 10, 11, 7, 0));

  expect(firesFor(KEFIR).slice(0, 3)).toEqual([
    '2026-11-11 09:00',
    '2026-11-16 09:00',
    '2026-11-18 09:00',
  ]);
});

it('still schedules the before-the-window reminder, and once when a time matches it', async () => {
  const windowed = habit(KEFIR, 'Burp the kefir', {
    timeRange: { start: '07:10', end: '08:00' },
    remindMinutesBefore: 10,
    reminderTimes: ['07:00', '19:00'],
  });

  await reminders.syncHabitReminders([windowed], true, {}, new Date(2026, 10, 11, 6, 0));

  expect(firesFor(KEFIR).slice(0, 3)).toEqual([
    '2026-11-11 07:00',
    '2026-11-11 19:00',
    '2026-11-12 07:00',
  ]);
});

it('keeps a full two weeks for a dozen reminders a day', async () => {
  const dozen = [1, 2, 3, 4].map((n) =>
    habit(`550e8400-e29b-41d4-a716-44665544092${n}`, `Habit ${n}`, {
      reminderTimes: ['08:00', '12:00', '18:00'],
    }),
  );

  await reminders.syncHabitReminders(dozen, true, {}, new Date(2026, 10, 11, 7, 0));

  expect(fake.pending.size).toBe(12 * 14);
  expect(local(fake.scheduledList().at(-1)!)).toBe('2026-11-24 18:00');
});

it('shortens the horizon to stay inside its share instead of dropping a habit', async () => {
  const busy = [1, 2, 3, 4, 5].map((n) =>
    habit(`550e8400-e29b-41d4-a716-44665544091${n}`, `Habit ${n}`, {
      reminderTimes: ['08:00', '12:00', '16:00', '20:00'],
    }),
  );
  const { NOTIFICATION_BUDGET } = require('../src/notifications/notificationBudget');

  await reminders.syncHabitReminders(busy, true, {}, new Date(2026, 10, 11, 7, 0));

  const pending = fake.scheduledList();
  expect(pending.length).toBeLessThanOrEqual(NOTIFICATION_BUDGET.habitReminders);
  // Every habit keeps its reminders; only the number of days ahead shrinks.
  for (const h of busy) {
    expect(firesFor(h.id).length).toBeGreaterThan(0);
  }
  // 20 a day over 14 days is 280; ten whole days fit in 200, the far four go.
  expect(pending).toHaveLength(200);
  expect(local(pending.at(-1)!)).toBe('2026-11-20 20:00');
});

it('keeps all shares together well under Android\'s 500 alarms per app', () => {
  const { NOTIFICATION_BUDGET } = require('../src/notifications/notificationBudget');
  const total = Object.values(NOTIFICATION_BUDGET as Record<string, number>).reduce(
    (sum, n) => sum + n,
    0,
  );

  expect(total).toBeLessThanOrEqual(300);
});

it('re-syncs to the same pending set without cancelling anything', async () => {
  const now = new Date(2026, 10, 11, 10, 0);
  await reminders.syncHabitReminders([kefir(), sprouts()], true, {}, now);
  const first = fake.scheduledList().map((r) => [r.identifier, local(r)]);
  expect(first.length).toBeGreaterThan(0);
  fake.cancelScheduledNotificationAsync.mockClear();

  await reminders.syncHabitReminders([kefir(), sprouts()], true, {}, now);

  expect(fake.scheduledList().map((r) => [r.identifier, local(r)])).toEqual(first);
  expect(fake.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});

it('a second identical sync schedules nothing', async () => {
  const now = new Date(2026, 10, 11, 10, 0);
  await reminders.syncHabitReminders([kefir(), sprouts()], true, {}, now);
  expect(fake.pending.size).toBeGreaterThan(0);
  fake.scheduleNotificationAsync.mockClear();
  fake.cancelScheduledNotificationAsync.mockClear();
  fake.getAllScheduledNotificationsAsync.mockClear();

  await reminders.syncHabitReminders([kefir(), sprouts()], true, {}, now);

  expect(fake.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(fake.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(fake.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
});

it('re-schedules only what changed: a renamed habit, a moved time', async () => {
  const now = new Date(2026, 10, 11, 10, 0);
  await reminders.syncHabitReminders([kefir(), sprouts()], true, {}, now);
  fake.scheduleNotificationAsync.mockClear();

  const renamed = habit(KEFIR, 'Feed the kefir', { reminderTimes: ['09:00'] });
  const moved = habit(SPROUTS, 'Rinse the sprouts', { reminderTimes: ['08:00', '21:00'] });
  await reminders.syncHabitReminders([renamed, moved], true, {}, now);

  const rescheduled = fake.scheduleNotificationAsync.mock.calls.map(([r]) => r.identifier);
  // 09:00 today has passed: 13 kefir days. 21:00 is still ahead: 14 new sprouts times.
  expect(rescheduled.filter((id) => id.includes(KEFIR))).toHaveLength(13);
  expect(rescheduled.filter((id) => id.includes(SPROUTS))).toHaveLength(14);
  expect(rescheduled.every((id) => !id.endsWith('-0800'))).toBe(true);
  expect(fake.scheduledList().filter((r) => r.identifier.endsWith('-2000'))).toEqual([]);
  const kefirBodies = fake
    .scheduledList()
    .filter((r) => r.identifier.includes(KEFIR))
    .map((r) => r.content.body);
  expect(new Set(kefirBodies)).toEqual(new Set(['Time for Feed the kefir']));
});

it('cancels the reminders of a habit that is archived or deleted, and nothing else', async () => {
  const now = new Date(2026, 10, 11, 10, 0);
  await reminders.scheduleEndOfDayReminder(true, '20:00');
  await fake.scheduleNotificationAsync({
    identifier: 'cal-reminder-dentist',
    content: {},
    trigger: { type: 'date', date: new Date(2026, 10, 12, 9, 0) },
  });
  await reminders.syncHabitReminders([kefir(), sprouts()], true, {}, now);

  await reminders.syncHabitReminders(
    [kefir({ archivedAt: '2026-11-11T09:00:00.000Z' }), sprouts()],
    true,
    {},
    now,
  );
  expect(firesFor(KEFIR)).toEqual([]);
  expect(firesFor(SPROUTS).length).toBeGreaterThan(0);

  await reminders.syncHabitReminders([], true, {}, now);
  expect(firesFor(SPROUTS)).toEqual([]);
  expect([...fake.pending.keys()].sort()).toEqual(['cal-reminder-dentist', 'habit-reminder-eod']);
});

it('the master switch off clears habit reminders but leaves the evening check-in', async () => {
  const now = new Date(2026, 10, 11, 10, 0);
  await reminders.scheduleEndOfDayReminder(true, '20:00');
  await reminders.syncHabitReminders([kefir()], true, {}, now);

  expect(fake.pending.size).toBeGreaterThan(1);

  await reminders.syncHabitReminders([kefir()], false, {}, now);

  expect([...fake.pending.keys()]).toEqual(['habit-reminder-eod']);
});

it('schedules nothing while notifications are not allowed', async () => {
  fake.state.permission = permission('denied', false);
  fake.state.answer = permission('denied', false);

  await reminders.syncHabitReminders([kefir()], true, {}, new Date(2026, 10, 11, 10, 0));

  expect(fake.pending.size).toBe(0);
});
