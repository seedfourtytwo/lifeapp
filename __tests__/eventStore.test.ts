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
    state().startHabitTimer(TIMER_HABIT, timerConfig);
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

function timerSessionEvent(id: string, seconds: number, endedAt: Date): LifeEvent {
  const startedAt = new Date(endedAt.getTime() - seconds * 1000);
  return {
    id,
    elementId: TIMER_HABIT,
    timestamp: endedAt.toISOString(),
    date: TODAY,
    value: seconds,
    meta: {
      source: 'timer_session',
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds: seconds,
    },
    protocolVersion: protocol.PROTOCOL_VERSION,
  };
}

describe('stopHabitTimer', () => {
  /**
   * Cold start: a stale session is finished before today's totals are loaded,
   * so the mirror holds nothing. The day's real total is in SQLite.
   */
  it('adds the session to the total SQLite holds, not to the mirror', async () => {
    await eventRepo.insertEvent(
      testDb.db,
      timerSessionEvent('550e8400-e29b-41d4-a716-446655440610', 360, new Date(2026, 2, 10, 7, 0)),
    );
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(5 * 60_000);

    await state().stopHabitTimer(TIMER_HABIT, timerConfig);

    expect(state().dailyTotals[TIMER_HABIT]).toBe(660);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
  });

  /**
   * Another write to the same habit (here an Undo of a reset) bumps the write
   * epoch while the stop waits for the lock. That must only stop the stop
   * from patching the mirror — the session's seconds still belong in SQLite.
   */
  it('still logs the session when another write to the habit overtakes it', async () => {
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(5 * 60_000);
    const lock = holdWriteLock();
    const stop = state().stopHabitTimer(TIMER_HABIT, timerConfig);
    const undo = state().restoreHabitDay(TIMER_HABIT, timerConfig, [
      timerSessionEvent('550e8400-e29b-41d4-a716-446655440611', 120, new Date(2026, 2, 10, 7, 0)),
    ]);

    lock.release();
    await Promise.all([lock.held, stop, undo]);

    expect((await eventsToday(TIMER_HABIT)).map((e) => e.value)).toContain(300);
  });

  /**
   * Done is tapped, and while that stop waits the play-once track ends
   * naturally and joins it with trackCompleted. The joined stop writes one
   * event, and it must carry what the joiner knew.
   */
  it('writes options from a stop that joined while the first waited', async () => {
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(5 * 60_000);
    const lock = holdWriteLock();
    const done = state().stopHabitTimer(TIMER_HABIT, timerConfig);
    const naturalEnd = state().stopHabitTimer(TIMER_HABIT, timerConfig, undefined, {
      trackCompleted: true,
    });

    lock.release();
    await Promise.all([lock.held, done, naturalEnd]);

    const events = await eventsToday(TIMER_HABIT);
    expect(events).toHaveLength(1);
    expect(events[0].meta).toMatchObject({ trackCompleted: true });
  });
});

describe('the goal in force', () => {
  it('is written on a timer session for a habit with a seconds target', async () => {
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(5 * 60_000);
    await state().stopHabitTimer(TIMER_HABIT, timerConfig);

    expect((await eventsToday(TIMER_HABIT))[0]?.meta).toMatchObject({ goalSeconds: 600 });
  });

  it('is not written for a timer without a seconds target', async () => {
    const openEnded = protocol.HabitConfigSchema.parse({ trackingMode: 'timer' });
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(5 * 60_000);
    await state().stopHabitTimer(TIMER_HABIT, openEnded);

    expect((await eventsToday(TIMER_HABIT))[0]?.meta).not.toHaveProperty('goalSeconds');
  });

  /** Raising the goal later must not turn yesterday, met at the old goal, into a miss. */
  it('keeps a past day done after the goal is raised', async () => {
    jest.setSystemTime(new Date(2026, 2, 9, 8, 0, 0));
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(10 * 60_000);
    await state().stopHabitTimer(TIMER_HABIT, timerConfig);

    jest.setSystemTime(MORNING);
    const raised = protocol.HabitConfigSchema.parse({ trackingMode: 'timer', dailyTargetSeconds: 1200 });
    await state().loadHabitStreaks([{ id: TIMER_HABIT, config: raised }]);

    expect(state().habitStreaks[TIMER_HABIT]).toBe(1);
  });
});

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

describe('pause and resume', () => {
  /**
   * The phone's clock jumps back (network time, a manual change) while a
   * timer is paused. A negative pause offset fails validation when sessions
   * are read back, which drops every saved session at the next start.
   */
  it('survives the clock going backwards while paused', async () => {
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(60_000);
    state().pauseHabitTimer(TIMER_HABIT);
    advance(-60 * 60_000);

    state().resumeHabitTimer(TIMER_HABIT, timerConfig);
    await flushPromises();

    expect(state().activeTimerSessions[TIMER_HABIT].pauseOffsetMs).toBe(0);
    const { loadPersistedActiveTimerSessions } = require('../src/db/repositories/activeTimerRepository') as typeof import('../src/db/repositories/activeTimerRepository');
    const persisted = await loadPersistedActiveTimerSessions(testDb.db);
    expect(Object.keys(persisted)).toEqual([TIMER_HABIT]);
  });
});

describe('counter undo', () => {
  /**
   * Undo used to "set today's total back" — which deletes the whole day and
   * writes one event stamped now. Earlier entries lost their times and notes.
   * Undo must remove exactly the taps it offers to undo.
   */
  it('removes only the undone taps and keeps the day\'s earlier entries', async () => {
    const earlier = {
      id: '550e8400-e29b-41d4-a716-446655440620',
      elementId: COUNTER,
      timestamp: new Date(2026, 2, 10, 6, 30).toISOString(),
      date: TODAY,
      value: 2,
      meta: { source: 'quick_button', increment: 2 },
      protocolVersion: protocol.PROTOCOL_VERSION,
    };
    await eventRepo.insertEvent(testDb.db, earlier);

    const first = await state().logEvent(COUNTER, 1);
    const second = await state().logEvent(COUNTER, 1);
    expect(first).toEqual(expect.any(String));
    expect(second).toEqual(expect.any(String));

    await state().deleteCounterEvents(COUNTER, [first as string, second as string]);

    expect(await eventsToday(COUNTER)).toEqual([earlier]);
    expect(state().dailyTotals[COUNTER]).toBe(2);
  });
});

describe('Done before the goal', () => {
  async function logEarlierSession(seconds: number): Promise<void> {
    await eventRepo.insertEvent(
      testDb.db,
      timerSessionEvent('550e8400-e29b-41d4-a716-446655440630', seconds, new Date(2026, 2, 10, 7, 0)),
    );
    await state().loadHabitDayState([{ id: TIMER_HABIT, config: timerConfig }]);
  }

  function markers(events: LifeEvent[]): LifeEvent[] {
    return events.filter((e) => e.meta?.source === 'manual_complete');
  }

  it('marks a partly done day done and keeps its seconds', async () => {
    await logEarlierSession(459);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(false);

    const undoable = await state().markHabitDone(TIMER_HABIT, timerConfig);

    const events = await eventsToday(TIMER_HABIT);
    expect(markers(events)).toEqual([expect.objectContaining({ value: 0 })]);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(459);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(state().habitStreaks[TIMER_HABIT]).toBe(1);
    expect(undoable).toBe(true);
  });

  it('stops a running timer, keeps its seconds and marks the day, in one write', async () => {
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(5 * 60_000);
    const lock = holdWriteLock();
    const done = state().markHabitDone(TIMER_HABIT, timerConfig);
    await Promise.resolve();
    expect(state().activeTimerSessions[TIMER_HABIT]).toBeUndefined();
    expect(await eventsToday(TIMER_HABIT)).toEqual([]);

    lock.release();
    await Promise.all([lock.held, done]);

    const events = await eventsToday(TIMER_HABIT);
    expect(events.map((e) => [e.meta?.source, e.value])).toEqual([
      ['timer_session', 300],
      ['manual_complete', 0],
    ]);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(300);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
  });

  it('writes no marker when the day is done without one', async () => {
    await logEarlierSession(700);

    expect(await state().markHabitDone(TIMER_HABIT, timerConfig)).toBe(false);
    expect(markers(await eventsToday(TIMER_HABIT))).toEqual([]);
  });

  /** After process death the track's end callback is gone; Done must still finish it. */
  it('finishes a play-once timer whose track can no longer report its end', async () => {
    const playOnce = protocol.HabitConfigSchema.parse({
      trackingMode: 'timer',
      timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
    });
    state().startHabitTimer(TIMER_HABIT, playOnce);
    advance(14 * 60_000);

    await state().markHabitDone(TIMER_HABIT, playOnce);

    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(14 * 60);
  });

  it('Undo removes only the marker and keeps the logged seconds', async () => {
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(5 * 60_000);
    await state().markHabitDone(TIMER_HABIT, timerConfig);

    await state().unmarkHabitDone(TIMER_HABIT, timerConfig);

    const events = await eventsToday(TIMER_HABIT);
    expect(events.map((e) => [e.meta?.source, e.value])).toEqual([['timer_session', 300]]);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(300);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(false);
    expect(state().habitStreaks[TIMER_HABIT]).toBe(0);
  });

  it('un-ticking a day done only by the marker keeps the timer sessions', async () => {
    await logEarlierSession(459);
    await state().markHabitDone(TIMER_HABIT, timerConfig);

    await state().toggleHabit(TIMER_HABIT, timerConfig);

    expect((await eventsToday(TIMER_HABIT)).map((e) => e.value)).toEqual([459]);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(false);
  });

  /** The lock-screen path only ever completes; it must not un-mark a Done. */
  it('the lock-screen complete leaves a marked day alone', async () => {
    await logEarlierSession(459);
    await state().markHabitDone(TIMER_HABIT, timerConfig);

    await state().completeHabit(TIMER_HABIT, timerConfig);

    const events = await eventsToday(TIMER_HABIT);
    expect(events.map((e) => e.meta?.source)).toEqual(['timer_session', 'manual_complete']);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
  });

  it('the streak and History agree on a day finished with Done', async () => {
    await logEarlierSession(459);
    await state().markHabitDone(TIMER_HABIT, timerConfig);

    const { loadTrackerHistory } = require('../src/store/trackerHistoryFetch') as typeof import('../src/store/trackerHistoryFetch');
    const element = await elementRepo.getElementById(testDb.db, TIMER_HABIT);
    const history = await loadTrackerHistory(testDb.db, element!, ['2026-03-09', TODAY]);

    expect(history.days.map((d) => d.done)).toEqual([false, true]);
    expect(history.streak).toBe(1);
    expect(state().habitStreaks[TIMER_HABIT]).toBe(1);
  });
});

describe('a timer running past its goal', () => {
  it('counts as done the moment it reaches the goal, before it is stopped', async () => {
    await state().loadHabitDayState([{ id: TIMER_HABIT, config: timerConfig }]);
    state().startHabitTimer(TIMER_HABIT, timerConfig);

    jest.advanceTimersByTime(599_000);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(false);
    jest.advanceTimersByTime(1_000);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
  });

  it('stays done when the day state reloads while it runs', async () => {
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    advance(11 * 60_000);

    await state().loadHabitDayState([{ id: TIMER_HABIT, config: timerConfig }]);

    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(0);
  });

  it('does not count a paused timer that has not reached the goal', async () => {
    await state().loadHabitDayState([{ id: TIMER_HABIT, config: timerConfig }]);
    state().startHabitTimer(TIMER_HABIT, timerConfig);
    jest.advanceTimersByTime(60_000);
    state().pauseHabitTimer(TIMER_HABIT);

    jest.advanceTimersByTime(20 * 60_000);

    expect(state().habitDoneToday[TIMER_HABIT]).toBe(false);
  });
});
