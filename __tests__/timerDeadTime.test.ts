/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads a fresh store after resetModules() */
import type { ActiveTimerSession, HabitConfig } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * A timer's seconds land on the day they happened, and a process that died
 * mid-session is not credited with the hours it was dead. Real store, real
 * SQLite, fake clock.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

type EventStoreModule = typeof import('../src/store/eventStore');
type EventRepo = typeof import('../src/db/repositories/eventRepository');
type TimerRepo = typeof import('../src/db/repositories/activeTimerRepository');

const HABIT = '550e8400-e29b-41d4-a716-446655440901';

let testDb: TestDb;
let store: EventStoreModule;
let eventRepo: EventRepo;
let timerRepo: TimerRepo;
let config: HabitConfig;

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
  timerRepo = require('../src/db/repositories/activeTimerRepository');
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
  require('../src/store/elementStore').useElementStore.setState({ elements: [element] });
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

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

/** What a previous process left behind when it died. */
async function persisted(session: ActiveTimerSession): Promise<void> {
  await timerRepo.persistActiveTimerSessions(testDb.db, { [HABIT]: session });
}

function session(startedAt: Date, heartbeatAt?: Date): ActiveTimerSession {
  return {
    startedAt: startedAt.toISOString(),
    pausedAt: null,
    pauseOffsetMs: 0,
    calendarDate: require('../src/protocol').toDateString(startedAt),
    ...(heartbeatAt ? { heartbeatAt: heartbeatAt.toISOString() } : {}),
  };
}

describe('the heartbeat', () => {
  it('is saved while a timer runs, at most every thirty seconds', async () => {
    await startAt(local(11, 11, 8));
    state().startHabitTimer(HABIT, config);

    setNow(local(11, 11, 8, 1));
    state().recordTimerHeartbeat();
    await flushPromises();
    const first = (await timerRepo.loadPersistedActiveTimerSessions(testDb.db))[HABIT]?.heartbeatAt;
    expect(first).toBe(local(11, 11, 8, 1).toISOString());

    setNow(new Date(local(11, 11, 8, 1).getTime() + 10_000));
    state().recordTimerHeartbeat();
    await flushPromises();
    expect((await timerRepo.loadPersistedActiveTimerSessions(testDb.db))[HABIT]?.heartbeatAt).toBe(first);
  });

  it('is not moved on while the timer is paused', async () => {
    await startAt(local(11, 11, 8));
    state().startHabitTimer(HABIT, config);
    state().pauseHabitTimer(HABIT);
    const before = state().activeTimerSessions[HABIT];

    setNow(local(11, 11, 8, 5));
    state().recordTimerHeartbeat();

    expect(state().activeTimerSessions[HABIT]).toBe(before);
  });
});

describe('a restart after the process died', () => {
  it('counts a session killed for three hours only up to its last heartbeat', async () => {
    await startAt(local(11, 11, 11, 20));
    await persisted(session(local(11, 11, 8), local(11, 11, 8, 20)));

    await state().hydrateActiveTimerSessions();

    // Kept, paused where the process died, for Chris to resume or finish.
    expect(state().activeTimerSessions[HABIT]?.pausedAt).toBe(local(11, 11, 8, 20).toISOString());
    await state().stopHabitTimer(HABIT, config);
    expect(await secondsOn('2026-11-11')).toEqual([20 * 60]);
  });

  it('splits a session killed after midnight between the two days, up to the heartbeat', async () => {
    await startAt(local(11, 11, 7));
    await persisted(session(local(11, 10, 23, 50), local(11, 11, 0, 5)));

    await state().hydrateActiveTimerSessions();

    expect(await secondsOn('2026-11-10')).toEqual([10 * 60]);
    expect(await secondsOn('2026-11-11')).toEqual([5 * 60]);
    expect(state().activeTimerSessions[HABIT]).toBeUndefined();
  });

  it('loads every saved session that still reads, even when one does not', async () => {
    await startAt(local(11, 11, 8, 30));
    const other = '550e8400-e29b-41d4-a716-446655440903';
    await require('../src/db/repositories/settingsRepository').setSetting(
      testDb.db,
      timerRepo.ACTIVE_TIMER_SESSIONS_KEY,
      JSON.stringify({
        [HABIT]: session(local(11, 11, 8)),
        [other]: { startedAt: 'not a date', calendarDate: '2026-11-11' },
      }),
    );

    expect(Object.keys(await timerRepo.loadPersistedActiveTimerSessions(testDb.db))).toEqual([HABIT]);
  });
});

describe('a session running past midnight', () => {
  it('gives each day its own seconds when stopped after midnight', async () => {
    await startAt(local(11, 10, 23, 50));
    state().startHabitTimer(HABIT, config);
    setNow(local(11, 11, 0, 20));

    await state().stopHabitTimer(HABIT, config);

    expect(await secondsOn('2026-11-10')).toEqual([10 * 60]);
    expect(await secondsOn('2026-11-11')).toEqual([20 * 60]);
    const [todayEvent] = await eventRepo.getEventsForElementOnDate(testDb.db, HABIT, '2026-11-11');
    expect(todayEvent?.meta).toMatchObject({ source: 'timer_session', goalSeconds: 3600 });
    expect(state().dailyTotals[HABIT]).toBe(20 * 60);
  });

  it('marks Done on the day the session ends, and offers Undo for it', async () => {
    await startAt(local(11, 10, 23, 50));
    state().startHabitTimer(HABIT, config);
    setNow(local(11, 11, 0, 20));

    const undoable = await state().markHabitDone(HABIT, config);

    const today = await eventRepo.getEventsForElementOnDate(testDb.db, HABIT, '2026-11-11');
    expect(today.map((e) => e.meta?.source)).toEqual(['timer_session', 'manual_complete']);
    expect(undoable).toBe(true);
  });

  it('keeps running through the day change, with yesterday\'s part already logged', async () => {
    await startAt(local(11, 10, 23, 50));
    const { ensureCurrentDay } = require('../src/hooks/ensureCurrentDay') as typeof import('../src/hooks/ensureCurrentDay');
    state().startHabitTimer(HABIT, config);
    setNow(local(11, 11, 0, 20));

    await ensureCurrentDay();

    expect(await secondsOn('2026-11-10')).toEqual([10 * 60]);
    expect(state().activeTimerSessions[HABIT]).toMatchObject({
      calendarDate: '2026-11-11',
      startedAt: local(11, 11, 0).toISOString(),
      pausedAt: null,
    });
    setNow(local(11, 11, 0, 30));
    await state().stopHabitTimer(HABIT, config);
    expect(await secondsOn('2026-11-11')).toEqual([30 * 60]);
  });

  it('is left alone by a late day change when it started today', async () => {
    await startAt(local(11, 10, 22));
    const { ensureCurrentDay } = require('../src/hooks/ensureCurrentDay') as typeof import('../src/hooks/ensureCurrentDay');
    // The maps still describe yesterday when a timer is started just after midnight.
    setNow(local(11, 11, 0, 10));
    state().startHabitTimer(HABIT, config);
    const started = state().activeTimerSessions[HABIT];
    setNow(local(11, 11, 0, 15));

    await ensureCurrentDay();

    expect(state().activeTimerSessions[HABIT]).toEqual(started);
    expect(await secondsOn('2026-11-11')).toEqual([]);
  });

  it('logs a session paused before midnight onto that day and ends it', async () => {
    await startAt(local(11, 10, 23));
    const { ensureCurrentDay } = require('../src/hooks/ensureCurrentDay') as typeof import('../src/hooks/ensureCurrentDay');
    state().startHabitTimer(HABIT, config);
    setNow(local(11, 10, 23, 30));
    state().pauseHabitTimer(HABIT);
    setNow(local(11, 11, 0, 30));

    await ensureCurrentDay();

    expect(await secondsOn('2026-11-10')).toEqual([30 * 60]);
    expect(state().activeTimerSessions[HABIT]).toBeUndefined();
  });

  it('counts the real hours of the spring-forward night', async () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'Europe/Paris';
    try {
      await startAt(local(3, 28, 23, 30));
      state().startHabitTimer(HABIT, config);
      setNow(local(3, 29, 3, 30));

      await state().stopHabitTimer(HABIT, config);

      expect(await secondsOn('2026-03-28')).toEqual([30 * 60]);
      expect(await secondsOn('2026-03-29')).toEqual([150 * 60]);
    } finally {
      process.env.TZ = previousTz;
    }
  });
});

