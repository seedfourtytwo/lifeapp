/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads a fresh store after resetModules() */
import type { HabitConfig, LifeEvent } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * The real event store against a real SQLite. Only the connection is swapped
 * (getDatabase hands back an in-memory database) and the clock is faked, so
 * every write, lock and mirror update here is the code the phone runs.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

type EventStoreModule = typeof import('../src/store/eventStore');
type ElementRepo = typeof import('../src/db/repositories/elementRepository');
type EventRepo = typeof import('../src/db/repositories/eventRepository');
type Protocol = typeof import('../src/protocol');
type WriteLock = typeof import('../src/db/writeLock');

const TICK_HABIT = '550e8400-e29b-41d4-a716-446655440601';
const TIMER_HABIT = '550e8400-e29b-41d4-a716-446655440602';
const COUNTER = '550e8400-e29b-41d4-a716-446655440603';
/** 08:00 local on a plain day, far from any clock change. */
const MORNING = new Date(2026, 2, 10, 8, 0, 0);
const TODAY = '2026-03-10';

let testDb: TestDb;
let store: EventStoreModule;
let elementRepo: ElementRepo;
let eventRepo: EventRepo;
let protocol: Protocol;
let writeLock: WriteLock;
let tickConfig: HabitConfig;
let timerConfig: HabitConfig;

beforeEach(async () => {
  jest.useFakeTimers({ now: MORNING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  store = require('../src/store/eventStore');
  elementRepo = require('../src/db/repositories/elementRepository');
  eventRepo = require('../src/db/repositories/eventRepository');
  protocol = require('../src/protocol');
  writeLock = require('../src/db/writeLock');

  tickConfig = protocol.HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' });
  timerConfig = protocol.HabitConfigSchema.parse({
    timeSlot: 'anytime',
    trackingMode: 'timer',
    dailyTargetSeconds: 600,
  });
  const createdAt = '2026-01-01T08:00:00.000Z';
  for (const [id, config] of [
    [TICK_HABIT, tickConfig],
    [TIMER_HABIT, timerConfig],
  ] as const) {
    await elementRepo.insertElement(testDb.db, {
      id,
      kind: 'habit',
      name: id === TICK_HABIT ? 'Stretch' : 'Meditate',
      config,
      protocolVersion: protocol.PROTOCOL_VERSION,
      createdAt,
      archivedAt: null,
    });
  }
  await elementRepo.insertElement(testDb.db, {
    id: COUNTER,
    kind: 'counter',
    name: 'Water',
    config: protocol.CounterConfigSchema.parse({ unit: 'glasses', quickIncrements: [1] }),
    protocolVersion: protocol.PROTOCOL_VERSION,
    createdAt,
    archivedAt: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
});

function state() {
  return store.useEventStore.getState();
}

async function eventsToday(elementId: string): Promise<LifeEvent[]> {
  return eventRepo.getEventsForElementOnDate(testDb.db, elementId, TODAY);
}

function advance(ms: number): void {
  jest.setSystemTime(Date.now() + ms);
}

/** Hold the DB write lock until the returned release is called. */
function holdWriteLock(): { release: () => void; held: Promise<void> } {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = writeLock.withDbWriteLock(() => gate);
  return { release, held };
}

describe('event store against SQLite', () => {
  it('ticks a check-off habit into the database and the mirror', async () => {
    await state().toggleHabit(TICK_HABIT, tickConfig);

    expect(await eventsToday(TICK_HABIT)).toHaveLength(1);
    expect(state().habitDoneToday[TICK_HABIT]).toBe(true);
    expect(state().habitStreaks[TICK_HABIT]).toBe(1);
  });

  it('logs a finished timer session as seconds on the day it ran', async () => {
    state().startHabitTimer(TIMER_HABIT);
    advance(5 * 60_000);
    await state().stopHabitTimer(TIMER_HABIT, timerConfig);

    const events = await eventsToday(TIMER_HABIT);
    expect(events.map((e) => e.value)).toEqual([300]);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(300);
    expect(state().activeTimerSessions[TIMER_HABIT]).toBeUndefined();
  });

  it('adds counter taps up in SQLite', async () => {
    await state().logEvent(COUNTER, 1);
    await state().logEvent(COUNTER, 2);

    expect((await eventsToday(COUNTER)).map((e) => e.value)).toEqual([1, 2]);
    expect(state().dailyTotals[COUNTER]).toBe(3);
  });

  it('can hold the write lock to stage a race', async () => {
    const lock = holdWriteLock();
    const tick = state().toggleHabit(TICK_HABIT, tickConfig);
    await Promise.resolve();
    expect(await eventsToday(TICK_HABIT)).toHaveLength(0);
    lock.release();
    await Promise.all([lock.held, tick]);
    expect(await eventsToday(TICK_HABIT)).toHaveLength(1);
  });
});

describe('toggleHabit', () => {
  /**
   * The first lock-screen press after midnight still sees yesterday's map,
   * where this habit was done. The press must tick today, not "un-tick" an
   * empty day and leave the habit showing undone.
   */
  it('decides from SQLite, not from a stale done map', async () => {
    store.useEventStore.setState({ habitDoneToday: { [TICK_HABIT]: true } });

    await state().toggleHabit(TICK_HABIT, tickConfig);

    expect(await eventsToday(TICK_HABIT)).toHaveLength(1);
    expect(state().habitDoneToday[TICK_HABIT]).toBe(true);
  });

  it('un-ticks a day SQLite says is done even if the mirror says it is not', async () => {
    await state().toggleHabit(TICK_HABIT, tickConfig);
    store.useEventStore.setState({ habitDoneToday: {} });

    await state().toggleHabit(TICK_HABIT, tickConfig);

    expect(await eventsToday(TICK_HABIT)).toHaveLength(0);
    expect(state().habitDoneToday[TICK_HABIT]).toBe(false);
  });

  /**
   * A day-state load that reads SQLite after the tap but before the tick is
   * written lands last and says "not done". The tick must win.
   */
  it('re-applies done after the write when a load overtook it', async () => {
    const lock = holdWriteLock();
    const tick = state().toggleHabit(TICK_HABIT, tickConfig);
    await state().loadHabitDayState([{ id: TICK_HABIT, config: tickConfig }]);
    expect(state().habitDoneToday[TICK_HABIT]).toBe(false);

    lock.release();
    await Promise.all([lock.held, tick]);

    expect(await eventsToday(TICK_HABIT)).toHaveLength(1);
    expect(state().habitDoneToday[TICK_HABIT]).toBe(true);
    expect(state().dailyTotals[TICK_HABIT]).toBe(1);
  });
});
