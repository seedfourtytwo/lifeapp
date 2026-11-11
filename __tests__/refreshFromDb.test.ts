/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import type { HabitConfig } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * `refreshFromDb()` is how the app catches up with rows it did not write
 * itself: whatever SQLite holds is what the stores show after one call. The
 * stores, repositories and database are real; only the sound is faked.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

const TICK_HABIT = '550e8400-e29b-41d4-a716-446655440901';
const TIMER_HABIT = '550e8400-e29b-41d4-a716-446655440902';
const COUNTER = '550e8400-e29b-41d4-a716-446655440903';
const TODAY = '2026-03-10';

let testDb: TestDb;
let protocol: typeof import('../src/protocol');
let eventRepo: typeof import('../src/db/repositories/eventRepository');
let tickConfig: HabitConfig;

beforeEach(async () => {
  jest.useFakeTimers({
    now: new Date(2026, 2, 10, 8, 0),
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
  });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);

  protocol = require('../src/protocol');
  eventRepo = require('../src/db/repositories/eventRepository');
  const elementRepo = require('../src/db/repositories/elementRepository') as typeof import('../src/db/repositories/elementRepository');
  tickConfig = protocol.HabitConfigSchema.parse({ trackingMode: 'boolean' });
  const timerConfig = protocol.HabitConfigSchema.parse({
    trackingMode: 'timer',
    dailyTargetSeconds: 600,
  });
  const counterConfig = protocol.CounterConfigSchema.parse({
    unit: 'glasses',
    quickIncrements: [1],
    dailyTarget: 3,
  });
  const trackers = [
    { id: TICK_HABIT, kind: 'habit', name: 'Kefir', config: tickConfig },
    { id: TIMER_HABIT, kind: 'habit', name: 'Meditate', config: timerConfig },
    { id: COUNTER, kind: 'counter', name: 'Water', config: counterConfig },
  ] as const;
  for (const [index, tracker] of trackers.entries()) {
    await elementRepo.insertElementWithDashboardItem(
      testDb.db,
      {
        ...tracker,
        protocolVersion: protocol.PROTOCOL_VERSION,
        createdAt: '2026-01-01T08:00:00.000Z',
        archivedAt: null,
      } as import('../src/protocol').ElementDefinition,
      { id: `550e8400-e29b-41d4-a716-44665544091${index}`, elementId: tracker.id, sortOrder: index },
    );
  }
});

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
});

function refreshFromDb(): Promise<void> {
  return (require('../src/hooks/refreshFromDb') as typeof import('../src/hooks/refreshFromDb')).refreshFromDb();
}

function eventState() {
  return (require('../src/store/eventStore') as typeof import('../src/store/eventStore')).useEventStore.getState();
}

function elementState() {
  return (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore.getState();
}

/** A row the stores never saw: the shape a second writer would leave. */
async function insertBehindTheStoresBack(elementId: string, value: number, id: string): Promise<void> {
  await eventRepo.insertEvent(testDb.db, {
    id,
    elementId,
    timestamp: new Date().toISOString(),
    date: TODAY,
    value,
    meta: elementId === COUNTER ? { source: 'quick_button', increment: value } : { source: 'habit_tick' },
    protocolVersion: protocol.PROTOCOL_VERSION,
  });
}

function writeLock(): typeof import('../src/db/writeLock') {
  return require('../src/db/writeLock');
}

describe('refreshFromDb', () => {
  it('shows rows written straight into SQLite after one call', async () => {
    await refreshFromDb();
    expect(eventState().habitDoneToday[TICK_HABIT]).toBe(false);

    await insertBehindTheStoresBack(TICK_HABIT, 1, '550e8400-e29b-41d4-a716-446655440921');
    await insertBehindTheStoresBack(COUNTER, 3, '550e8400-e29b-41d4-a716-446655440922');
    await refreshFromDb();

    const state = eventState();
    expect(state.habitDoneToday[TICK_HABIT]).toBe(true);
    expect(state.habitStreaks[TICK_HABIT]).toBe(1);
    expect(state.dailyTotals[COUNTER]).toBe(3);
    expect(state.counterStreaks[COUNTER]).toBe(1);
    expect(state.dayStateReady).toBe(true);
    expect(state.counterTotalsReady).toBe(true);
  });

  it('drops a tracker archived behind the stores', async () => {
    await refreshFromDb();
    testDb.raw.prepare('UPDATE elements SET archived_at = ? WHERE id = ?').run('2026-03-10T07:00:00.000Z', COUNTER);
    await refreshFromDb();

    expect(elementState().dashboard.map((item) => item.elementId)).toEqual([TICK_HABIT, TIMER_HABIT]);
  });

  it('mirrors the session the native core holds, whoever started or ended it', async () => {
    await refreshFromDb();
    const { lifeCore } = require('../src/core/lifeCore') as typeof import('../src/core/lifeCore');
    await lifeCore.start({
      trackerId: TIMER_HABIT,
      name: 'Meditate',
      lockScreenName: null,
      iconKey: null,
      goal: { type: 'seconds', seconds: 600 },
      trackId: null,
      loop: true,
      loggedSeconds: 0,
    });

    await refreshFromDb();
    expect(eventState().activeTimerSessions).toEqual({
      [TIMER_HABIT]: {
        startedAt: new Date(2026, 2, 10, 8, 0).toISOString(),
        pausedAt: null,
        pauseOffsetMs: 0,
        calendarDate: TODAY,
      },
    });

    await lifeCore.discard();
    await refreshFromDb();
    expect(eventState().activeTimerSessions).toEqual({});
  });

  it('coalesces a burst of calls into at most one more pass', async () => {
    await refreshFromDb();
    const reads = jest.spyOn(eventRepo, 'getDayFactsForElementsOnDate');

    await insertBehindTheStoresBack(TICK_HABIT, 1, '550e8400-e29b-41d4-a716-446655440923');
    await Promise.all([refreshFromDb(), refreshFromDb(), refreshFromDb(), refreshFromDb()]);

    expect(reads.mock.calls.length).toBeLessThanOrEqual(2);
    expect(eventState().habitDoneToday[TICK_HABIT]).toBe(true);
  });

  it('a call during a guarded write waits for it and then shows what it wrote', async () => {
    await refreshFromDb();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = writeLock().withDbWriteLock(async () => {
      await gate;
      await insertBehindTheStoresBack(TICK_HABIT, 1, '550e8400-e29b-41d4-a716-446655440924');
    });

    const refresh = refreshFromDb();
    release();
    await Promise.all([write, refresh]);

    expect(eventState().habitDoneToday[TICK_HABIT]).toBe(true);
  });

  it('a call during an import neither deadlocks nor keeps the replaced rows', async () => {
    await insertBehindTheStoresBack(TICK_HABIT, 1, '550e8400-e29b-41d4-a716-446655440925');
    await refreshFromDb();
    expect(eventState().habitDoneToday[TICK_HABIT]).toBe(true);

    const { bumpDataGeneration } = require('../src/db/dataGeneration') as typeof import('../src/db/dataGeneration');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const importing = writeLock().withDbWriteLock(async () => {
      bumpDataGeneration('protocol');
      await gate;
      testDb.raw.exec('DELETE FROM events');
    });

    const refresh = refreshFromDb();
    release();
    await Promise.all([importing, refresh]);

    expect(eventState().habitDoneToday[TICK_HABIT]).toBe(false);
    expect(eventState().habitStreaks[TICK_HABIT]).toBe(0);
  });
});
