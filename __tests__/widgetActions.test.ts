/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import * as fs from 'node:fs';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { createFakeFileSystem, type FakeFileSystem } from './support/fakeFileSystem';
import { seedRealisticTrackers, TRACKERS } from './support/realisticTrackers';
import type { HabitConfig, LifeEvent } from '../src/protocol';

/**
 * Taps the widget queued, drained through the real stores into a real
 * SQLite from a real file. Only the sound is faked.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../src/audio/habitTimerSound');
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
  const sound = require('../src/audio/habitTimerSound') as typeof import('../src/audio/habitTimerSound');
  for (const fn of [sound.playHabitSound, sound.resumeHabitSound, sound.stopHabitSound, sound.pauseHabitSound]) {
    (fn as jest.Mock).mockResolvedValue(undefined);
  }
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

type ActionFields = { type: string; trackerId: string; amount?: number; day?: string; at?: Date; id?: string };

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

function append(...lines: (Record<string, unknown> | string)[]): void {
  for (const line of lines) {
    fs.appendFileSync(pendingPath(), `${typeof line === 'string' ? line : JSON.stringify(line)}\n`);
  }
}

async function eventsOn(elementId: string, date: string): Promise<LifeEvent[]> {
  const eventRepo = require('../src/db/repositories/eventRepository') as typeof import('../src/db/repositories/eventRepository');
  return eventRepo.getEventsForElementOnDate(testDb.db, elementId, date);
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve));
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

  it('starts, pauses, resumes and finishes a timer', async () => {
    const id = TRACKERS.meditation;
    append(action({ type: 'timer_start', trackerId: id }));
    await drain();
    expect(events().activeTimerSessions[id]).toMatchObject({ pausedAt: null });

    jest.setSystemTime(new Date(2026, 2, 10, 9, 35));
    append(action({ type: 'timer_pause', trackerId: id }));
    await drain();
    expect(events().activeTimerSessions[id].pausedAt).not.toBeNull();

    append(action({ type: 'timer_resume', trackerId: id }));
    await drain();
    expect(events().activeTimerSessions[id].pausedAt).toBeNull();

    append(action({ type: 'timer_done', trackerId: id }));
    await drain();
    await settle();
    expect(events().activeTimerSessions[id]).toBeUndefined();
    expect((await eventsOn(id, TODAY)).map((e) => [e.meta?.source, e.value])).toEqual([
      ['timer_session', 300],
      ['manual_complete', 0],
    ]);
    expect(events().habitDoneToday[id]).toBe(true);
  });

  it('throws a discarded session away without logging it', async () => {
    append(action({ type: 'timer_start', trackerId: TRACKERS.breathing }));
    await drain();
    jest.setSystemTime(new Date(2026, 2, 10, 9, 40));

    append(action({ type: 'timer_discard', trackerId: TRACKERS.breathing }));
    await drain();

    expect(events().activeTimerSessions[TRACKERS.breathing]).toBeUndefined();
    expect(await eventsOn(TRACKERS.breathing, TODAY)).toEqual([]);
  });

  it('applies an action whose id it has seen once only', async () => {
    const tap = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 2 });
    const start = action({ type: 'timer_start', trackerId: TRACKERS.breathing });
    append(tap, tap, start);
    await drain();

    // Done, then the same start arrives again (the widget re-wrote a line).
    await events().markHabitDone(TRACKERS.breathing, configs.get(TRACKERS.breathing)!);
    append(start, tap);
    const again = await drain();

    expect(events().dailyTotals[TRACKERS.water]).toBe(2);
    expect(events().activeTimerSessions[TRACKERS.breathing]).toBeUndefined();
    expect(again).toMatchObject({ applied: 0, duplicates: 2 });
  });

  it('finishes a queue a drain died on after the rename, without applying any of it twice', async () => {
    const first = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 1 });
    const second = action({ type: 'timer_start', trackerId: TRACKERS.breathing });
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
    const notATimer = action({ type: 'timer_start', trackerId: TRACKERS.kefir });
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

  it('puts taps made before midnight on the day they were made, and drops a timer start for it', async () => {
    const lateEvening = new Date(2026, 2, 9, 23, 50);
    const tick = action({ type: 'habit_complete', trackerId: TRACKERS.kefir, day: YESTERDAY, at: lateEvening });
    const water = action({ type: 'counter_add', trackerId: TRACKERS.water, amount: 1, day: YESTERDAY, at: lateEvening });
    const start = action({ type: 'timer_start', trackerId: TRACKERS.meditation, day: YESTERDAY, at: lateEvening });
    append(tick, water, start);

    const result = await drain();

    expect(await eventsOn(TRACKERS.kefir, YESTERDAY)).toHaveLength(1);
    expect(await eventsOn(TRACKERS.kefir, TODAY)).toEqual([]);
    expect(events().habitDoneToday[TRACKERS.kefir]).toBe(false);
    expect(events().habitStreaks[TRACKERS.kefir]).toBe(1);
    expect((await eventsOn(TRACKERS.water, YESTERDAY)).map((e) => e.timestamp)).toEqual([water.at]);
    expect(events().activeTimerSessions[TRACKERS.meditation]).toBeUndefined();
    expect(result.dropped).toEqual([{ id: start.id, reason: 'day_ended' }]);
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
