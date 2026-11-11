/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import * as fs from 'node:fs';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { createFakeFileSystem, type FakeFileSystem } from './support/fakeFileSystem';
import { seedRealisticTrackers, TRACKERS } from './support/realisticTrackers';
import type { HabitConfig, LifeEvent } from '../src/protocol';

/**
 * Taps the widget queued, drained through the real stores into a real
 * SQLite from a real file.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
let mockFs: FakeFileSystem;
jest.mock('expo-file-system/legacy', () => mockFs.module);

/** Tuesday 10 March 2026, 09:30 local. */
const NOW = new Date(2026, 2, 10, 9, 30);
const TODAY = '2026-03-10';
const YESTERDAY = '2026-03-09';

let testDb: TestDb;
let configs: Map<string, HabitConfig>;
let actionSeq = 0;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  mockFs = createFakeFileSystem();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  const trackers = await seedRealisticTrackers(testDb.db);
  configs = new Map(
    trackers.flatMap((tracker) => (tracker.kind === 'habit' ? [[tracker.id, tracker.config]] : [])),
  );
  await (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore.getState().load();
  fs.mkdirSync(`${mockFs.root}/widget`, { recursive: true });
});

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
  mockFs.cleanup();
});

function drain() {
  return (require('../src/widget/pendingWidgetActions') as typeof import('../src/widget/pendingWidgetActions')).drainPendingWidgetActions();
}

function events() {
  return (require('../src/store/eventStore') as typeof import('../src/store/eventStore')).useEventStore.getState();
}

const pendingPath = () => `${mockFs.root}/widget/pending-actions.jsonl`;
const drainingPath = () => `${mockFs.root}/widget/pending-actions.draining.jsonl`;

type ActionFields = { type: string; trackerId?: string; amount?: number; day?: string; at?: Date; id?: string } & Record<string, unknown>;

/** One action line, the way the widget writes it. */
function action(fields: ActionFields): { id: string; at: string } & Record<string, unknown> {
  actionSeq += 1;
  const { at = new Date(), day = TODAY, id, ...rest } = fields;
  return {
    v: 1,
    id: id ?? `550e8400-e29b-41d4-a716-${String(446655442000 + actionSeq)}`,
    at: at.toISOString(),
    day,
    ...rest,
  };
}

/** A finished session, the way the native core queues it. */
function session(
  trackerId: string,
  startedAt: Date,
  endedAt: Date,
  options: { pausedMs?: number; goal?: number | null; markComplete?: boolean; trackCompleted?: boolean; id?: string } = {},
): Record<string, unknown> & { id: string; at: string } {
  const { pausedMs = 0, goal = null, markComplete = false, trackCompleted = false, id } = options;
  return action({
    type: 'timer_session',
    trackerId,
    at: endedAt,
    day: endedAt.getDate() === NOW.getDate() ? TODAY : YESTERDAY,
    id,
    ...{
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      pausedMs,
      activeSeconds: Math.floor((endedAt.getTime() - startedAt.getTime() - pausedMs) / 1000),
      goalSecondsInForce: goal,
      trackCompleted,
      markComplete,
    },
  } as ActionFields);
}

function append(...lines: (Record<string, unknown> | string)[]): void {
  for (const line of lines) {
    fs.appendFileSync(pendingPath(), `${typeof line === 'string' ? line : JSON.stringify(line)}\n`);
  }
}

async function eventsOn(elementId: string, date: string): Promise<LifeEvent[]> {
  const eventRepo = require('../src/db/repositories/eventRepository') as typeof import('../src/db/repositories/eventRepository');
  return eventRepo.getEventsForElementOnDate(testDb.db, elementId, date);
}

describe('draining the widget queue', () => {
  it('ticks a habit, then removes the queue', async () => {
    append(action({ type: 'habit_complete', trackerId: TRACKERS.kefir }));

    const result = await drain();

    expect(result).toMatchObject({ applied: 1, duplicates: 0, malformed: 0, dropped: [] });
    expect(await eventsOn(TRACKERS.kefir, TODAY)).toHaveLength(1);
    expect(events().habitDoneToday[TRACKERS.kefir]).toBe(true);
    expect(fs.existsSync(pendingPath())).toBe(false);
    expect(fs.existsSync(drainingPath())).toBe(false);
  });

  it('never un-ticks a habit that is already done', async () => {
    await events().toggleHabit(TRACKERS.kefir, configs.get(TRACKERS.kefir)!);
    append(action({ type: 'habit_complete', trackerId: TRACKERS.kefir }));

    await drain();

    expect(await eventsOn(TRACKERS.kefir, TODAY)).toHaveLength(1);
    expect(events().habitDoneToday[TRACKERS.kefir]).toBe(true);
  });

  it('adds to a counter at the moment of the tap, under the tap id', async () => {
    const tap = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 3, at: new Date(2026, 2, 10, 9, 10) });
    append(tap);

    await drain();

    const logged = await eventsOn(TRACKERS.water, TODAY);
    expect(logged).toEqual([
      expect.objectContaining({ id: tap.id, value: 3, timestamp: tap.at }),
    ]);
    expect(events().dailyTotals[TRACKERS.water]).toBe(3);
  });

  it('logs a finished session with the goal it ran under', async () => {
    const id = TRACKERS.meditation;
    append(session(id, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 20), { pausedMs: 60_000, goal: 900 }));

    const result = await drain();

    expect(result).toMatchObject({ applied: 1, dropped: [], malformed: 0 });
    expect((await eventsOn(id, TODAY)).map((e) => [e.meta?.source, e.value, e.meta?.goalSeconds])).toEqual([
      ['timer_session', 1140, 900],
    ]);
    expect(events().dailyTotals[id]).toBe(1140);
    expect(events().habitDoneToday[id]).toBe(true);
  });

  it('marks the day done for a session ended with Done short of its goal', async () => {
    const id = TRACKERS.meditation;
    append(session(id, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 5), { goal: 900, markComplete: true }));

    await drain();

    expect((await eventsOn(id, TODAY)).map((e) => [e.meta?.source, e.value])).toEqual([
      ['timer_session', 300],
      ['manual_complete', 0],
    ]);
    expect(events().habitDoneToday[id]).toBe(true);
    expect(events().habitMarkedToday[id]).toBe(true);
  });

  it('adds no mark when the session itself reached the goal', async () => {
    const id = TRACKERS.breathing;
    append(session(id, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 6), { goal: 300, markComplete: true }));

    await drain();

    expect((await eventsOn(id, TODAY)).map((e) => e.meta?.source)).toEqual(['timer_session']);
    expect(events().habitMarkedToday[id]).toBe(false);
  });

  it('keeps an Undo of the Done mark when the same session line arrives again', async () => {
    const id = TRACKERS.meditation;
    const line = session(id, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 5), { goal: 900, markComplete: true });
    append(line);
    await drain();
    await events().unmarkHabitDone(id, configs.get(id)!);

    append(line);
    const again = await drain();

    expect(again).toMatchObject({ applied: 0, duplicates: 1 });
    expect((await eventsOn(id, TODAY)).map((e) => e.meta?.source)).toEqual(['timer_session']);
    expect(events().habitDoneToday[id]).toBe(false);
  });

  it('gives each day its own seconds for a session that ran past midnight', async () => {
    const id = TRACKERS.meditation;
    append(session(id, new Date(2026, 2, 9, 23, 50), new Date(2026, 2, 10, 0, 20), { goal: 900 }));

    await drain();

    expect((await eventsOn(id, YESTERDAY)).map((e) => e.value)).toEqual([600]);
    expect((await eventsOn(id, TODAY)).map((e) => e.value)).toEqual([1200]);
    expect(events().dailyTotals[id]).toBe(1200);
  });

  it('records a track that played to its end', async () => {
    const id = TRACKERS.meditation;
    append(session(id, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 15), { trackCompleted: true }));

    await drain();

    expect((await eventsOn(id, TODAY))[0]?.meta?.trackCompleted).toBe(true);
  });

  it('applies an action whose id it has seen once only', async () => {
    const tap = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 2 });
    const finished = session(TRACKERS.breathing, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 2));
    append(tap, tap, finished, finished);
    await drain();

    append(finished, tap);
    const again = await drain();

    expect(events().dailyTotals[TRACKERS.water]).toBe(2);
    expect(await eventsOn(TRACKERS.breathing, TODAY)).toHaveLength(1);
    expect(again).toMatchObject({ applied: 0, duplicates: 2 });
  });

  it('a session applied just before the drain died is not logged twice', async () => {
    append(session(TRACKERS.meditation, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 5), { goal: 900, markComplete: true }));
    const save = jest.spyOn(require('../src/db/repositories/widgetActionLogRepository'), 'saveWidgetActionLog');
    save.mockRejectedValueOnce(new Error('process killed'));
    await expect(drain()).rejects.toThrow('process killed');
    save.mockRestore();

    await drain();

    expect((await eventsOn(TRACKERS.meditation, TODAY)).map((e) => e.meta?.source)).toEqual([
      'timer_session',
      'manual_complete',
    ]);
  });

  it('skips the timer control lines of contract v1: control is native now', async () => {
    for (const type of ['timer_start', 'timer_pause', 'timer_resume', 'timer_done', 'timer_discard']) {
      append(action({ type, trackerId: TRACKERS.meditation }));
    }

    const result = await drain();

    expect(result).toMatchObject({ applied: 0, malformed: 5 });
    expect(await eventsOn(TRACKERS.meditation, TODAY)).toEqual([]);
  });

  it('finishes a queue a drain died on after the rename, without applying any of it twice', async () => {
    const first = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 1 });
    const second = session(TRACKERS.breathing, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 2));
    append(first, second);
    const fsModule = mockFs.module as { deleteAsync: jest.Mock };
    fsModule.deleteAsync.mockRejectedValueOnce(new Error('process killed'));

    await expect(drain()).rejects.toThrow('process killed');
    expect(fs.existsSync(drainingPath())).toBe(true);
    // The widget kept tapping meanwhile.
    append(action({ type: 'habit_complete', trackerId: TRACKERS.creatine }));

    const result = await drain();

    expect(result).toMatchObject({ applied: 1, duplicates: 2 });
    expect(await eventsOn(TRACKERS.water, TODAY)).toHaveLength(1);
    expect(events().habitDoneToday[TRACKERS.creatine]).toBe(true);
    expect(fs.existsSync(drainingPath())).toBe(false);
    expect(fs.existsSync(pendingPath())).toBe(false);
  });

  it('a counter tap applied just before the drain died is not counted twice', async () => {
    const tap = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 1 });
    append(tap);
    // The tap was written to SQLite, but the drain died before logging it.
    const save = jest.spyOn(require('../src/db/repositories/widgetActionLogRepository'), 'saveWidgetActionLog');
    save.mockRejectedValueOnce(new Error('process killed'));
    await expect(drain()).rejects.toThrow('process killed');
    save.mockRestore();

    await drain();

    expect(await eventsOn(TRACKERS.water, TODAY)).toHaveLength(1);
  });

  it('skips and counts lines it cannot read, and applies the rest', async () => {
    append(
      'not json',
      JSON.stringify({ ...action({ type: 'habit_complete', trackerId: TRACKERS.kefir }), v: 2 }),
      action({ type: 'wave_hello', trackerId: TRACKERS.kefir }),
      action({ type: 'counter_add', trackerId: TRACKERS.water, amount: -1 }),
      action({ type: 'habit_complete', trackerId: TRACKERS.creatine }),
    );
    fs.appendFileSync(pendingPath(), '{"v":1,"id":"cut off');

    const result = await drain();

    expect(result).toMatchObject({ applied: 1, malformed: 5 });
    expect(events().habitDoneToday[TRACKERS.creatine]).toBe(true);
    expect(await eventsOn(TRACKERS.kefir, TODAY)).toEqual([]);
  });

  it('drops an action for an archived or deleted tracker, with the reason', async () => {
    const elementStore = (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore;
    await elementStore.getState().archiveElement(TRACKERS.coffee);
    await elementStore.getState().deleteElement(TRACKERS.sprouts);
    const archived = action({ type: 'counter_add', trackerId: TRACKERS.coffee, amount: 1 });
    const deleted = action({ type: 'habit_complete', trackerId: TRACKERS.sprouts });
    const notATimer = session(TRACKERS.kefir, new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 9, 2));
    const tickOnTimer = action({ type: 'habit_complete', trackerId: TRACKERS.meditation });
    append(archived, deleted, notATimer, tickOnTimer);

    const result = await drain();

    expect(result.dropped).toEqual([
      { id: archived.id, reason: 'tracker_archived' },
      { id: deleted.id, reason: 'tracker_missing' },
      { id: notATimer.id, reason: 'not_a_timer' },
      { id: tickOnTimer.id, reason: 'wrong_kind' },
    ]);
    expect(await eventsOn(TRACKERS.coffee, TODAY)).toEqual([]);
    const { loadWidgetActionLog } = require('../src/db/repositories/widgetActionLogRepository') as typeof import('../src/db/repositories/widgetActionLogRepository');
    expect((await loadWidgetActionLog(testDb.db)).get(archived.id)).toMatchObject({
      outcome: 'dropped',
      reason: 'tracker_archived',
    });
  });

  it('puts taps made before midnight on the day they were made', async () => {
    const lateEvening = new Date(2026, 2, 9, 23, 50);
    const tick = action({ type: 'habit_complete', trackerId: TRACKERS.kefir, day: YESTERDAY, at: lateEvening });
    const water = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 1, day: YESTERDAY, at: lateEvening });
    append(tick, water);

    const result = await drain();

    expect(await eventsOn(TRACKERS.kefir, YESTERDAY)).toHaveLength(1);
    expect(await eventsOn(TRACKERS.kefir, TODAY)).toEqual([]);
    expect(events().habitDoneToday[TRACKERS.kefir]).toBe(false);
    expect(events().habitStreaks[TRACKERS.kefir]).toBe(1);
    expect((await eventsOn(TRACKERS.water, YESTERDAY)).map((e) => e.timestamp)).toEqual([water.at]);
    expect(result.dropped).toEqual([]);
  });

  it('runs as part of refreshFromDb', async () => {
    append(action({ type: 'habit_complete', trackerId: TRACKERS.creatine }));

    await (require('../src/hooks/refreshFromDb') as typeof import('../src/hooks/refreshFromDb')).refreshFromDb();

    expect(events().habitDoneToday[TRACKERS.creatine]).toBe(true);
  });

  it('does nothing when there is no queue', async () => {
    expect(await drain()).toEqual({ applied: 0, duplicates: 0, dropped: [], malformed: 0 });
  });
});

describe('urge lines in the widget queue', () => {
  function urgeRows(): Record<string, unknown>[] {
    return testDb.raw.prepare('SELECT * FROM urges ORDER BY at').all() as Record<string, unknown>[];
  }

  function urges() {
    return (require('../src/store/urgeStore') as typeof import('../src/store/urgeStore')).useUrgeStore.getState();
  }

  function logged(at = new Date(2026, 2, 10, 9, 25)) {
    return action({ type: 'urge_logged', at });
  }

  function resolved(urgeId: string, outcome: string, at = new Date(2026, 2, 10, 9, 27)) {
    return action({ type: 'urge_resolved', urgeId, outcome, at });
  }

  it('inserts an urge logged on the widget, open, under the line id', async () => {
    const line = logged();
    append(line);

    const result = await drain();

    expect(result).toMatchObject({ applied: 1, dropped: [], malformed: 0 });
    expect(urgeRows()).toEqual([
      expect.objectContaining({ id: line.id, at: line.at, day: TODAY, outcome: null, source: 'widget' }),
    ]);
    expect(urges().ride).toMatchObject({ urgeId: line.id, startedAt: line.at });
  });

  it('resolves it as used at the moment of the tap', async () => {
    const line = logged();
    append(line, resolved(line.id, 'used'));

    await drain();

    expect(urgeRows()[0]).toMatchObject({
      outcome: 'used',
      resolved_at: new Date(2026, 2, 10, 9, 27).toISOString(),
    });
    expect(urges().riddenOutTotal).toBe(0);
  });

  it('inserts and resolves once however often the lines arrive', async () => {
    const line = logged();
    const used = resolved(line.id, 'used');
    append(line, line, used, used);
    await drain();
    append(line, used);

    const again = await drain();

    expect(urgeRows()).toHaveLength(1);
    expect(again).toMatchObject({ applied: 0, duplicates: 2 });
  });

  it('applies a resolve written before its log in the same file', async () => {
    const line = logged();
    append(resolved(line.id, 'used'), line);

    const result = await drain();

    expect(result.dropped).toEqual([]);
    expect(urgeRows()[0]).toMatchObject({ id: line.id, outcome: 'used' });
  });

  it('drops a resolve for an urge it has never seen, with the reason', async () => {
    const stray = resolved('550e8400-e29b-41d4-a716-446655449000', 'used');
    append(stray);

    const result = await drain();

    expect(result.dropped).toEqual([{ id: stray.id, reason: 'urge_missing' }]);
    expect(urgeRows()).toEqual([]);
  });

  it('keeps the first outcome: a used tap after the ride was ridden out changes nothing', async () => {
    const line = logged(new Date(2026, 2, 10, 9, 0));
    append(line);
    await drain();
    await urges().refresh();
    append(resolved(line.id, 'used', new Date(2026, 2, 10, 9, 25)));

    await drain();

    expect(urgeRows()[0]).toMatchObject({ outcome: 'rode_out' });
    expect(urges().riddenOutTotal).toBe(1);
  });

  it('drops an urge logged on a day still to come', async () => {
    const ahead = action({ type: 'urge_logged', day: '2026-03-11', at: new Date(2026, 2, 11, 9, 0) });
    append(ahead);

    expect((await drain()).dropped).toEqual([{ id: ahead.id, reason: 'future_day' }]);
  });

  it('skips a resolve line with an outcome it does not know', async () => {
    const line = logged();
    append(line, resolved(line.id, 'gave_in'));

    expect(await drain()).toMatchObject({ applied: 1, malformed: 1 });
  });
});
