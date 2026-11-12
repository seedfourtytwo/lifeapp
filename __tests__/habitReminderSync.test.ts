/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh stores after resetModules() */
/**
 * The habit reminder watcher: the real element and settings stores feeding
 * the reminder plan the native scheduler reads, written onto a real
 * directory. Only expo-notifications, the file system root and the database
 * connection are faked; the native core is the fake one.
 */
import * as fs from 'node:fs';
import type { ElementDefinition, HabitElement } from '../src/protocol';
import type { ReminderPlan } from '../src/protocol/reminderPlan';
import { createFakeFileSystem, type FakeFileSystem } from './support/fakeFileSystem';
import { permission, type FakeNotifications } from './support/fakeNotifications';
import { habitElement } from './support/elements';

jest.mock('expo-notifications', () =>
  require('./support/fakeNotifications').createFakeNotifications(),
);
jest.mock('../src/db/client', () => ({ getDatabase: jest.fn() }));
let mockFs: FakeFileSystem;
jest.mock('expo-file-system/legacy', () => mockFs.module);

type Watch = typeof import('../src/hooks/useHabitReminderSync');
type Stores = {
  elements: typeof import('../src/store/elementStore').useElementStore;
  events: typeof import('../src/store/eventStore').useEventStore;
  settings: typeof import('../src/store/settingsStore').useSettingsStore;
};

const KEFIR = '550e8400-e29b-41d4-a716-446655440951';

let watch: Watch;
let stores: Stores;
let fake: FakeNotifications;
let remindersChanged: jest.SpyInstance;
let stop: () => void;

const kefir = (extra: Partial<Omit<HabitElement, 'kind'>> = {}): ElementDefinition => ({
  ...habitElement({
    id: KEFIR,
    name: 'Burp the kefir',
    createdAt: '2026-01-01T08:00:00.000Z',
    config: { trackingMode: 'boolean', schedule: { type: 'daily' }, reminderTimes: ['09:00'] },
  }),
  ...extra,
});

/** Past the settle delay, then let the queued write run to the end. */
async function settle(): Promise<void> {
  await jest.advanceTimersByTimeAsync(2000);
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

function planPath(): string {
  return `${mockFs.root}/widget/reminders.json`;
}

function readPlan(): ReminderPlan {
  const { ReminderPlanSchema } = require('../src/protocol/reminderPlan') as typeof import('../src/protocol/reminderPlan');
  return ReminderPlanSchema.parse(JSON.parse(fs.readFileSync(planPath(), 'utf8')));
}

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 10, 11, 7, 0),
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
  });
  jest.resetModules();
  mockFs = createFakeFileSystem();
  fake = require('expo-notifications');
  watch = require('../src/hooks/useHabitReminderSync');
  remindersChanged = jest.spyOn(require('../src/core/lifeCore').lifeCore, 'remindersChanged');
  stores = {
    elements: require('../src/store/elementStore').useElementStore,
    events: require('../src/store/eventStore').useEventStore,
    settings: require('../src/store/settingsStore').useSettingsStore,
  };
});

afterEach(() => {
  stop?.();
  mockFs.cleanup();
  jest.useRealTimers();
});

function loadAll(elements: ElementDefinition[] = [kefir()]): void {
  stores.settings.setState({ isLoaded: true });
  stores.elements.setState({ elements, isLoaded: true });
}

it('writes nothing until the habits and settings have loaded', async () => {
  stop = watch.watchHabitReminders();
  await settle();

  expect(fs.existsSync(planPath())).toBe(false);
  expect(remindersChanged).not.toHaveBeenCalled();
});

it('hands the plan to the native scheduler once everything has loaded', async () => {
  stop = watch.watchHabitReminders();
  loadAll();
  await settle();

  expect(readPlan()).toMatchObject({
    enabled: true,
    language: 'en',
    habits: [{ id: KEFIR, name: 'Burp the kefir', reminderTimes: ['09:00'] }],
  });
  expect(remindersChanged).toHaveBeenCalledTimes(1);
});

it('cancels, once, the habit reminders the old scheduler left pending, and keeps the evening check-in', async () => {
  for (const identifier of [`habit-reminder-${KEFIR}-2026-11-12-0900`, 'habit-reminder-eod']) {
    await fake.scheduleNotificationAsync({
      identifier,
      content: {},
      trigger: { type: 'date', date: new Date(2026, 10, 12, 9, 0) },
    });
  }

  stop = watch.watchHabitReminders();
  loadAll();
  await settle();
  stop();
  stop = watch.watchHabitReminders();
  await settle();

  expect([...fake.pending.keys()]).toEqual(['habit-reminder-eod']);
  expect(fake.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
});

it('says off when the master switch goes off', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  stores.settings.setState({ trackerRemindersEnabled: false });
  await settle();

  expect(readPlan().enabled).toBe(false);
});

it('says off while notifications are not allowed', async () => {
  fake.state.permission = permission('denied', false);
  fake.state.answer = permission('denied', false);
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  expect(readPlan().enabled).toBe(false);
});

it('drops a habit that is archived', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  stores.elements.setState({ elements: [kefir({ archivedAt: '2026-11-11T06:30:00.000Z' })] });
  await settle();

  expect(readPlan().habits).toEqual([]);
});

it('follows the app language', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  stores.settings.setState({ appLanguage: 'fr' });
  await settle();

  expect(readPlan().language).toBe('fr');
});

it('leaves the plan alone for a tick or a new day: native judges those at the moment', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();
  remindersChanged.mockClear();

  stores.events.setState({ habitDoneToday: { [KEFIR]: true }, dailyTotals: { [KEFIR]: 1 } });
  jest.setSystemTime(new Date(2026, 10, 12, 7, 0));
  await settle();

  expect(remindersChanged).not.toHaveBeenCalled();
});
