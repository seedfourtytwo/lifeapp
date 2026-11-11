/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh stores after resetModules() */
/**
 * The "timer target reached" notification, driven by the real event store on
 * a real SQLite. Only expo-notifications and the database connection are
 * swapped; every start, pause, resume and stop is the code the phone runs.
 */
import type { ElementDefinition, HabitConfig } from '../src/protocol';
import type { FakeNotifications, FakeRequest } from './support/fakeNotifications';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

jest.mock('expo-notifications', () =>
  require('./support/fakeNotifications').createFakeNotifications(),
);
jest.mock('../src/db/client', () => ({ getDatabase: jest.fn() }));

type EventStore = typeof import('../src/store/eventStore');

const MEDITATE = '550e8400-e29b-41d4-a716-446655440961';
const BREATHE = '550e8400-e29b-41d4-a716-446655440962';
const OPEN_ENDED = '550e8400-e29b-41d4-a716-446655440963';
const MORNING = new Date(2026, 10, 11, 8, 0, 0);
const TODAY = '2026-11-11';

let testDb: TestDb;
let store: EventStore;
let fake: FakeNotifications;
let stop: () => void;
let configs: Record<string, HabitConfig>;

function element(id: string, name: string, config: HabitConfig): ElementDefinition {
  return {
    id,
    kind: 'habit',
    name,
    config,
    protocolVersion: 1,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  };
}

beforeEach(async () => {
  jest.useFakeTimers({ now: MORNING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  fake = require('expo-notifications');
  store = require('../src/store/eventStore');
  const { HabitConfigSchema } = require('../src/protocol');
  configs = {
    [MEDITATE]: HabitConfigSchema.parse({ trackingMode: 'timer', dailyTargetSeconds: 600 }),
    [BREATHE]: HabitConfigSchema.parse({ trackingMode: 'timer', dailyTargetSeconds: 300 }),
    [OPEN_ENDED]: HabitConfigSchema.parse({ trackingMode: 'timer' }),
  };
  const elementRepo = require('../src/db/repositories/elementRepository');
  const elements = [
    element(MEDITATE, 'Meditate', configs[MEDITATE]!),
    element(BREATHE, 'Breathe', configs[BREATHE]!),
    element(OPEN_ENDED, 'Stretch', configs[OPEN_ENDED]!),
  ];
  for (const el of elements) await elementRepo.insertElement(testDb.db, el);
  require('../src/store/elementStore').useElementStore.setState({ elements, isLoaded: true });
  store.useEventStore.setState({ dayMapsDate: TODAY, dailyTotals: {}, dayStateReady: true });
  stop = require('../src/hooks/useHabitTimerNotificationSync').watchHabitTimerNotification();
});

afterEach(() => {
  stop();
  jest.useRealTimers();
  testDb.raw.close();
});

function state() {
  return store.useEventStore.getState();
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

function timerNotifications(): FakeRequest[] {
  return fake.scheduledList().filter((r) => r.identifier.startsWith('habit-timer-'));
}

function firesInSeconds(request: FakeRequest): number {
  return (new Date(request.trigger.date!).getTime() - MORNING.getTime()) / 1000;
}

it('schedules one notification for when the target is reached', async () => {
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();

  const [request, ...rest] = timerNotifications();
  expect(rest).toEqual([]);
  expect(request!.identifier).toBe(`habit-timer-${MEDITATE}`);
  expect(firesInSeconds(request!)).toBe(600);
  expect(request!.trigger).toEqual(expect.objectContaining({ type: 'date', channelId: 'reminders' }));
  expect(request!.content.body).toContain('Meditate');
});

it('counts what was already logged today', async () => {
  store.useEventStore.setState({ dailyTotals: { [MEDITATE]: 120 } });

  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();

  expect(timerNotifications().map(firesInSeconds)).toEqual([480]);
});

it('schedules nothing for a timer without a seconds target, or one already past it', async () => {
  state().startHabitTimer(OPEN_ENDED, configs[OPEN_ENDED]!);
  await flush();
  expect(timerNotifications()).toEqual([]);

  state().discardHabitTimer(OPEN_ENDED);
  store.useEventStore.setState({ dailyTotals: { [MEDITATE]: 600 } });
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();
  expect(timerNotifications()).toEqual([]);
});

it('cancels on pause and reschedules on resume, later by the time spent paused', async () => {
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  jest.setSystemTime(MORNING.getTime() + 60_000);
  state().pauseHabitTimer(MEDITATE);
  await flush();
  expect(timerNotifications()).toEqual([]);

  jest.setSystemTime(MORNING.getTime() + 5 * 60_000);
  state().resumeHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();

  // 60 s run, 4 min paused, 540 s still to go.
  expect(timerNotifications().map(firesInSeconds)).toEqual([300 + 540]);
});

it('cancels when the timer is finished', async () => {
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();
  jest.setSystemTime(MORNING.getTime() + 60_000);

  await state().stopHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();

  expect(timerNotifications()).toEqual([]);
});

it('cancels when the day is reset', async () => {
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();
  jest.setSystemTime(MORNING.getTime() + 60_000);

  await state().resetHabitToday(MEDITATE, configs[MEDITATE]!);
  await flush();

  expect(timerNotifications()).toEqual([]);
});

it('cancels when the timer is discarded', async () => {
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();

  state().discardHabitTimer(MEDITATE);
  await flush();

  expect(timerNotifications()).toEqual([]);
});

it('follows the timer that takes over', async () => {
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();
  jest.setSystemTime(MORNING.getTime() + 60_000);

  // What starting another timer does: finish the running one, then start.
  await state().stopHabitTimer(MEDITATE, configs[MEDITATE]!);
  state().startHabitTimer(BREATHE, configs[BREATHE]!);
  await flush();

  const pending = timerNotifications();
  expect(pending.map((r) => r.identifier)).toEqual([`habit-timer-${BREATHE}`]);
  expect(pending.map(firesInSeconds)).toEqual([60 + 300]);
});

it('does not reschedule while nothing about the timer changes', async () => {
  state().startHabitTimer(MEDITATE, configs[MEDITATE]!);
  await flush();
  fake.scheduleNotificationAsync.mockClear();

  store.useEventStore.setState({ habitStreaks: { [BREATHE]: 3 } });
  await flush();

  expect(fake.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('asks Android for exact alarms, so expo-notifications schedules the trigger exactly', () => {
  const app = require('../app.json');

  expect(app.expo.android.permissions).toContain('android.permission.USE_EXACT_ALARM');
});
