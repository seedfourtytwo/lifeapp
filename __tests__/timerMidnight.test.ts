/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads a fresh store after resetModules() */
import type { HabitConfig } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { timerKit } from './support/timerKit';

/**
 * A timer's seconds land on the day they happened. Real store, real SQLite,
 * fake clock, and the fake native core. That a process which died
 * mid-session is not credited with the time it was dead is the native
 * core's rule now: `TimerSessionTest.kt` covers it.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

type EventStoreModule = typeof import('../src/store/eventStore');
type EventRepo = typeof import('../src/db/repositories/eventRepository');

const HABIT = '550e8400-e29b-41d4-a716-446655440901';

let testDb: TestDb;
let store: EventStoreModule;
let eventRepo: EventRepo;
let config: HabitConfig;
let timer: ReturnType<typeof timerKit>;

function local(month: number, day: number, hour: number, minute = 0): Date {
  return new Date(2026, month - 1, day, hour, minute);
}

async function startAt(now: Date): Promise<void> {
  jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  store = require('../src/store/eventStore');
  eventRepo = require('../src/db/repositories/eventRepository');
  const protocol = require('../src/protocol') as typeof import('../src/protocol');
  config = protocol.HabitConfigSchema.parse({
    timeSlot: 'anytime',
    trackingMode: 'timer',
    dailyTargetSeconds: 3600,
  });
  const element = {
    id: HABIT,
    kind: 'habit' as const,
    name: 'Meditate',
    config,
    protocolVersion: protocol.PROTOCOL_VERSION,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  };
  await require('../src/db/repositories/elementRepository').insertElement(testDb.db, element);
  await require('../src/db/repositories/dashboardRepository').insertDashboardItem(testDb.db, {
    id: '550e8400-e29b-41d4-a716-446655440902',
    elementId: HABIT,
    sortOrder: 0,
  });
  timer = timerKit([element]);
}

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
});

function state() {
  return store.useEventStore.getState();
}

function setNow(at: Date): void {
  jest.setSystemTime(at);
}

async function secondsOn(date: string): Promise<number[]> {
  return (await eventRepo.getEventsForElementOnDate(testDb.db, HABIT, date)).map((e) => e.value);
}

describe('a session running past midnight', () => {
  it('gives each day its own seconds when stopped after midnight', async () => {
    await startAt(local(11, 10, 23, 50));
    await timer.press(HABIT);
    setNow(local(11, 11, 0, 20));

    await timer.stop();

    expect(await secondsOn('2026-11-10')).toEqual([10 * 60]);
    expect(await secondsOn('2026-11-11')).toEqual([20 * 60]);
    const [todayEvent] = await eventRepo.getEventsForElementOnDate(testDb.db, HABIT, '2026-11-11');
    expect(todayEvent?.meta).toMatchObject({ source: 'timer_session', goalSeconds: 3600 });
    expect(state().dailyTotals[HABIT]).toBe(20 * 60);
  });

  it('marks Done on the day the session ends, and offers Undo for it', async () => {
    await startAt(local(11, 10, 23, 50));
    await timer.press(HABIT);
    setNow(local(11, 11, 0, 20));

    const undoable = await timer.controls.markHabitTimerDone(HABIT, config);

    const today = await eventRepo.getEventsForElementOnDate(testDb.db, HABIT, '2026-11-11');
    expect(today.map((e) => e.meta?.source)).toEqual(['timer_session', 'manual_complete']);
    expect(undoable).toBe(true);
  });

  it('runs on through the day change, shown from midnight, and is split when it ends', async () => {
    await startAt(local(11, 10, 23, 50));
    const { ensureCurrentDay } = require('../src/hooks/ensureCurrentDay') as typeof import('../src/hooks/ensureCurrentDay');
    await timer.press(HABIT);
    setNow(local(11, 11, 0, 20));

    await ensureCurrentDay();

    expect(state().activeTimerSessions[HABIT]).toMatchObject({
      calendarDate: '2026-11-11',
      startedAt: local(11, 11, 0).toISOString(),
      pausedAt: null,
    });
    setNow(local(11, 11, 0, 30));
    await timer.stop();
    expect(await secondsOn('2026-11-10')).toEqual([10 * 60]);
    expect(await secondsOn('2026-11-11')).toEqual([30 * 60]);
  });

  it('is left alone by a late day change when it started today', async () => {
    await startAt(local(11, 10, 22));
    const { ensureCurrentDay } = require('../src/hooks/ensureCurrentDay') as typeof import('../src/hooks/ensureCurrentDay');
    // The maps still describe yesterday when a timer is started just after midnight.
    setNow(local(11, 11, 0, 10));
    await timer.press(HABIT);
    const started = state().activeTimerSessions[HABIT];
    setNow(local(11, 11, 0, 15));

    await ensureCurrentDay();

    expect(state().activeTimerSessions[HABIT]).toEqual(started);
    expect(await secondsOn('2026-11-11')).toEqual([]);
  });

  it('logs a session paused before midnight onto that day and ends it', async () => {
    await startAt(local(11, 10, 23));
    const { ensureCurrentDay } = require('../src/hooks/ensureCurrentDay') as typeof import('../src/hooks/ensureCurrentDay');
    await timer.press(HABIT);
    setNow(local(11, 10, 23, 30));
    await timer.press(HABIT);
    setNow(local(11, 11, 0, 30));

    await ensureCurrentDay();

    expect(await secondsOn('2026-11-10')).toEqual([30 * 60]);
    expect(state().activeTimerSessions[HABIT]).toBeUndefined();
    await expect(timer.core.getState()).resolves.toBeNull();
  });

  it('counts the real hours of the spring-forward night', async () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'Europe/Paris';
    try {
      await startAt(local(3, 28, 23, 30));
      await timer.press(HABIT);
      setNow(local(3, 29, 3, 30));

      await timer.stop();

      expect(await secondsOn('2026-03-28')).toEqual([30 * 60]);
      expect(await secondsOn('2026-03-29')).toEqual([150 * 60]);
    } finally {
      process.env.TZ = previousTz;
    }
  });
});

