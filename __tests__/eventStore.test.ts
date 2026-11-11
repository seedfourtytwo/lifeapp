/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads a fresh store after resetModules() */
import type { ElementDefinition, HabitConfig, LifeEvent } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { timerKit } from './support/timerKit';

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
let timer: ReturnType<typeof timerKit>;

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
  const habits: ElementDefinition[] = [];
  for (const [id, config] of [
    [TICK_HABIT, tickConfig],
    [TIMER_HABIT, timerConfig],
  ] as const) {
    const element: ElementDefinition = {
      id,
      kind: 'habit',
      name: id === TICK_HABIT ? 'Stretch' : 'Meditate',
      config,
      protocolVersion: protocol.PROTOCOL_VERSION,
      createdAt,
      archivedAt: null,
    };
    await elementRepo.insertElement(testDb.db, element);
    habits.push(element);
  }
  timer = timerKit(habits);
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
    await timer.press(TIMER_HABIT);
    advance(5 * 60_000);
    await timer.stop();

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

describe('a finished session', () => {
  /**
   * Cold start: a stale session is finished before today's totals are loaded,
   * so the mirror holds nothing. The day's real total is in SQLite.
   */
  it('adds the session to the total SQLite holds, not to the mirror', async () => {
    await eventRepo.insertEvent(
      testDb.db,
      timerSessionEvent('550e8400-e29b-41d4-a716-446655440610', 360, new Date(2026, 2, 10, 7, 0)),
    );
    await timer.press(TIMER_HABIT);
    advance(5 * 60_000);

    await timer.stop();

    expect(state().dailyTotals[TIMER_HABIT]).toBe(660);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
  });

  /**
   * Another write to the same habit (here an Undo of a reset) lands while
   * the session waits for the lock. The session's seconds still belong in SQLite.
   */
  it('still logs the session when another write to the habit overtakes it', async () => {
    await timer.press(TIMER_HABIT);
    advance(5 * 60_000);
    const lock = holdWriteLock();
    const stop = timer.stop();
    const undo = state().restoreHabitDay(TIMER_HABIT, timerConfig, [
      timerSessionEvent('550e8400-e29b-41d4-a716-446655440611', 120, new Date(2026, 2, 10, 7, 0)),
    ]);

    lock.release();
    await Promise.all([lock.held, stop, undo]);

    expect((await eventsToday(TIMER_HABIT)).map((e) => e.value)).toContain(300);
  });

  it('starting another habit ends the running one and logs its seconds', async () => {
    const other = '550e8400-e29b-41d4-a716-446655440604';
    const otherElement = {
      id: other,
      kind: 'habit' as const,
      name: 'Breathe',
      config: timerConfig,
      protocolVersion: protocol.PROTOCOL_VERSION,
      createdAt: '2026-01-01T08:00:00.000Z',
      archivedAt: null,
    };
    await elementRepo.insertElement(testDb.db, otherElement);
    timer = timerKit([...require('../src/store/elementStore').useElementStore.getState().elements, otherElement]);
    await timer.press(TIMER_HABIT);
    advance(4 * 60_000);

    await timer.press(other);

    expect((await eventsToday(TIMER_HABIT)).map((e) => e.value)).toEqual([240]);
    expect(Object.keys(state().activeTimerSessions)).toEqual([other]);
  });
});

describe('the goal in force', () => {
  it('is written on a timer session for a habit with a seconds target', async () => {
    await timer.press(TIMER_HABIT);
    advance(5 * 60_000);
    await timer.stop();

    expect((await eventsToday(TIMER_HABIT))[0]?.meta).toMatchObject({ goalSeconds: 600 });
  });

  it('is not written for a timer without a seconds target', async () => {
    const openEnded = protocol.HabitConfigSchema.parse({ trackingMode: 'timer' });
    const habit = await elementRepo.getElementById(testDb.db, TIMER_HABIT);
    timer = timerKit([{ ...habit!, config: openEnded } as ElementDefinition]);
    await timer.press(TIMER_HABIT);
    advance(5 * 60_000);
    await timer.stop();

    expect((await eventsToday(TIMER_HABIT))[0]?.meta).not.toHaveProperty('goalSeconds');
  });

  /** Raising the goal later must not turn yesterday, met at the old goal, into a miss. */
  it('keeps a past day done after the goal is raised', async () => {
    jest.setSystemTime(new Date(2026, 2, 9, 8, 0, 0));
    await timer.press(TIMER_HABIT);
    advance(10 * 60_000);
    await timer.stop();

    jest.setSystemTime(MORNING);
    const raised = protocol.HabitConfigSchema.parse({ trackingMode: 'timer', dailyTargetSeconds: 1200 });
    await state().loadHabitStreaks([{ id: TIMER_HABIT, config: raised }]);

    expect(state().habitStreaks[TIMER_HABIT]).toBe(1);
  });
});

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

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

    const undoable = await timer.controls.markHabitTimerDone(TIMER_HABIT, timerConfig);

    const events = await eventsToday(TIMER_HABIT);
    expect(markers(events)).toEqual([expect.objectContaining({ value: 0 })]);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(459);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(state().habitStreaks[TIMER_HABIT]).toBe(1);
    expect(undoable).toBe(true);
  });

  it('stops a running timer, keeps its seconds and marks the day, in one write', async () => {
    await timer.press(TIMER_HABIT);
    advance(5 * 60_000);
    const lock = holdWriteLock();
    const done = timer.controls.markHabitTimerDone(TIMER_HABIT, timerConfig);
    await flushPromises();
    expect(state().activeTimerSessions[TIMER_HABIT]).toBeUndefined();
    expect(await eventsToday(TIMER_HABIT)).toEqual([]);

    lock.release();
    const [, undoable] = await Promise.all([lock.held, done]);

    const events = await eventsToday(TIMER_HABIT);
    expect(events.map((e) => [e.meta?.source, e.value])).toEqual([
      ['timer_session', 300],
      ['manual_complete', 0],
    ]);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(300);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(undoable).toBe(true);
  });

  it('writes no marker when the day is done without one', async () => {
    await logEarlierSession(700);

    expect(await timer.controls.markHabitTimerDone(TIMER_HABIT, timerConfig)).toBe(false);
    expect(markers(await eventsToday(TIMER_HABIT))).toEqual([]);
  });

  /** A play-once session ended by Done before its track does still counts the day. */
  it('finishes a play-once timer before its track ends', async () => {
    const playOnce = protocol.HabitConfigSchema.parse({
      trackingMode: 'timer',
      timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
    });
    const habit = await elementRepo.getElementById(testDb.db, TIMER_HABIT);
    timer = timerKit([{ ...habit!, config: playOnce } as ElementDefinition]);
    await timer.press(TIMER_HABIT);
    advance(14 * 60_000);

    await timer.controls.markHabitTimerDone(TIMER_HABIT, playOnce);

    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(14 * 60);
  });

  it('tells the card a day is done only by the mark, through a reload, and not after Undo', async () => {
    await logEarlierSession(459);
    await timer.controls.markHabitTimerDone(TIMER_HABIT, timerConfig);
    expect(state().habitMarkedToday[TIMER_HABIT]).toBe(true);

    store.useEventStore.setState({ habitMarkedToday: {} });
    await state().loadHabitDayState([{ id: TIMER_HABIT, config: timerConfig }]);
    expect(state().habitMarkedToday[TIMER_HABIT]).toBe(true);

    await timer.controls.unmarkHabitTimerDone(TIMER_HABIT, timerConfig);
    expect(state().habitMarkedToday[TIMER_HABIT]).toBe(false);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(459);
  });

  it('does not call a day whose goal was met done only by the mark', async () => {
    await logEarlierSession(700);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(state().habitMarkedToday[TIMER_HABIT]).toBe(false);
  });

  it('Undo removes only the marker and keeps the logged seconds', async () => {
    await timer.press(TIMER_HABIT);
    advance(5 * 60_000);
    await timer.controls.markHabitTimerDone(TIMER_HABIT, timerConfig);

    await timer.controls.unmarkHabitTimerDone(TIMER_HABIT, timerConfig);

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
    await timer.press(TIMER_HABIT);

    jest.advanceTimersByTime(599_000);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(false);
    jest.advanceTimersByTime(1_000);
    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
  });

  it('stays done when the day state reloads while it runs', async () => {
    await timer.press(TIMER_HABIT);
    advance(11 * 60_000);

    await state().loadHabitDayState([{ id: TIMER_HABIT, config: timerConfig }]);

    expect(state().habitDoneToday[TIMER_HABIT]).toBe(true);
    expect(state().dailyTotals[TIMER_HABIT]).toBe(0);
  });

  it('does not count a paused timer that has not reached the goal', async () => {
    await state().loadHabitDayState([{ id: TIMER_HABIT, config: timerConfig }]);
    await timer.press(TIMER_HABIT);
    jest.advanceTimersByTime(60_000);
    await timer.press(TIMER_HABIT);

    jest.advanceTimersByTime(20 * 60_000);

    expect(state().habitDoneToday[TIMER_HABIT]).toBe(false);
  });
});

describe('the database is the only truth for today', () => {
  it('shows a tick only once SQLite holds it', async () => {
    const lock = holdWriteLock();
    const tick = state().toggleHabit(TICK_HABIT, tickConfig);
    await flushPromises();
    expect(state().habitDoneToday[TICK_HABIT]).toBeUndefined();

    lock.release();
    await Promise.all([lock.held, tick]);
    expect(state().habitDoneToday[TICK_HABIT]).toBe(true);
  });

  it('shows what SQLite holds after a write an import overtook', async () => {
    const { bumpDataGeneration } = require('../src/db/dataGeneration') as typeof import('../src/db/dataGeneration');
    const lock = holdWriteLock();
    const tick = state().toggleHabit(TICK_HABIT, tickConfig);
    bumpDataGeneration('protocol');

    lock.release();
    await Promise.all([lock.held, tick]);

    expect(await eventsToday(TICK_HABIT)).toEqual([]);
    expect(state().habitDoneToday[TICK_HABIT]).toBe(false);
  });

  it('shows what SQLite holds after a write that failed', async () => {
    const insert = jest.spyOn(eventRepo, 'insertEvent').mockRejectedValueOnce(new Error('disk full'));

    await expect(state().toggleHabit(TICK_HABIT, tickConfig)).rejects.toThrow('disk full');

    insert.mockRestore();
    expect(state().habitDoneToday[TICK_HABIT]).toBe(false);
    expect(state().dailyTotals[TICK_HABIT]).toBe(0);
  });

  it('a counter tap brings its target streak along', async () => {
    const withTarget = protocol.CounterConfigSchema.parse({
      unit: 'glasses',
      quickIncrements: [1],
      dailyTarget: 2,
    });
    await elementRepo.updateElement(testDb.db, COUNTER, { name: 'Water', config: withTarget }, 'counter');

    await state().logEvent(COUNTER, 1);
    expect(state().counterStreaks[COUNTER]).toBe(0);
    await state().logEvent(COUNTER, 1);
    expect(state().counterStreaks[COUNTER]).toBe(1);
  });
});
