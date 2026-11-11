/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh stores after resetModules() */
/**
 * The habit reminder watcher: the real element, event and settings stores
 * feeding the real scheduler. Store state is set the way their loaders set
 * it; only expo-notifications (and the database connection) are faked.
 */
import type { ElementDefinition, HabitElement } from '../src/protocol';
import type { FakeNotifications } from './support/fakeNotifications';
import { habitElement } from './support/elements';

jest.mock('expo-notifications', () =>
  require('./support/fakeNotifications').createFakeNotifications(),
);
jest.mock('../src/db/client', () => ({ getDatabase: jest.fn() }));

type Watch = typeof import('../src/hooks/useHabitReminderSync');
type Stores = {
  elements: typeof import('../src/store/elementStore').useElementStore;
  events: typeof import('../src/store/eventStore').useEventStore;
  settings: typeof import('../src/store/settingsStore').useSettingsStore;
};

const KEFIR = '550e8400-e29b-41d4-a716-446655440951';
/** Wednesday 11 November 2026, 07:00 local. */
const MORNING = new Date(2026, 10, 11, 7, 0);
const TODAY = '2026-11-11';

let watch: Watch;
let stores: Stores;
let fake: FakeNotifications;
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

/** Past the settle delay, then let the queued sync run to the end. */
async function settle(): Promise<void> {
  await jest.advanceTimersByTimeAsync(2000);
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

function kefirDays(): string[] {
  return fake
    .scheduledList()
    .filter((r) => r.identifier.startsWith(`habit-reminder-${KEFIR}-`))
    .map((r) => r.identifier.slice(`habit-reminder-${KEFIR}-`.length, -5));
}

beforeEach(() => {
  jest.useFakeTimers({ now: MORNING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  fake = require('expo-notifications');
  watch = require('../src/hooks/useHabitReminderSync');
  stores = {
    elements: require('../src/store/elementStore').useElementStore,
    events: require('../src/store/eventStore').useEventStore,
    settings: require('../src/store/settingsStore').useSettingsStore,
  };
});

afterEach(() => {
  stop?.();
  jest.useRealTimers();
});

function loadAll(elements: ElementDefinition[] = [kefir()]): void {
  stores.settings.setState({ isLoaded: true });
  stores.elements.setState({ elements, isLoaded: true });
  stores.events.setState({ habitDoneToday: {}, dayMapsDate: TODAY, dayStateReady: true });
}

it('touches nothing until the habits and settings have loaded', async () => {
  await fake.scheduleNotificationAsync({
    identifier: `habit-reminder-${KEFIR}-2026-11-12-0900`,
    content: {},
    trigger: { type: 'date', date: new Date(2026, 10, 12, 9, 0) },
  });

  stop = watch.watchHabitReminders();
  await settle();

  expect(fake.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(fake.pending.size).toBe(1);
});

it('schedules the reminders once everything has loaded', async () => {
  stop = watch.watchHabitReminders();
  loadAll();
  await settle();

  expect(kefirDays()).toHaveLength(14);
  expect(kefirDays()[0]).toBe(TODAY);
});

it('drops the rest of today when the habit is ticked off', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  stores.events.setState({ habitDoneToday: { [KEFIR]: true } });
  await settle();

  expect(kefirDays()[0]).toBe('2026-11-12');
  expect(kefirDays()).toHaveLength(13);
});

it('cancels the reminders of a habit that is archived', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  stores.elements.setState({ elements: [kefir({ archivedAt: '2026-11-11T06:30:00.000Z' })] });
  await settle();

  expect(kefirDays()).toEqual([]);
});

it('cancels them all when the master switch goes off', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  stores.settings.setState({ trackerRemindersEnabled: false });
  await settle();

  expect(fake.pending.size).toBe(0);
});

it('moves the two-week window on when the day changes', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();

  jest.setSystemTime(new Date(2026, 10, 12, 7, 0));
  stores.events.setState({ dayMapsDate: '2026-11-12', habitDoneToday: {} });
  await settle();

  expect(kefirDays()[0]).toBe('2026-11-12');
  expect(kefirDays().at(-1)).toBe('2026-11-25');
});

it('treats done-today from a stale day as not done', async () => {
  loadAll();
  stores.events.setState({ habitDoneToday: { [KEFIR]: true }, dayMapsDate: '2026-11-10' });
  stop = watch.watchHabitReminders();
  await settle();

  expect(kefirDays()[0]).toBe(TODAY);
});

it('does not re-sync for a change that cannot move a reminder', async () => {
  loadAll();
  stop = watch.watchHabitReminders();
  await settle();
  fake.scheduleNotificationAsync.mockClear();

  stores.events.setState({ dailyTotals: { someCounter: 3 } });
  await settle();

  expect(fake.scheduleNotificationAsync).not.toHaveBeenCalled();
});
