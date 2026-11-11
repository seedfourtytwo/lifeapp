/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import * as fs from 'node:fs';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { createFakeFileSystem, type FakeFileSystem } from './support/fakeFileSystem';
import { seedRealisticTrackers, TRACKERS } from './support/realisticTrackers';
import type { ElementDefinition, HabitConfig } from '../src/protocol';
import type { WidgetSnapshot } from '../src/protocol/widgetSnapshot';

/**
 * The file the widget reads, written by the real stores from a real SQLite
 * onto a real directory. The timer is the fake native core.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
let mockFs: FakeFileSystem;
jest.mock('expo-file-system/legacy', () => mockFs.module);

/** Tuesday 10 March 2026, 09:30 local. */
const NOW = new Date(2026, 2, 10, 9, 30);
const TODAY = '2026-03-10';

let testDb: TestDb;
let trackers: ElementDefinition[];
let uninstall: () => void;

function writer(): typeof import('../src/widget/widgetSnapshotWriter') {
  return require('../src/widget/widgetSnapshotWriter');
}

function events() {
  return (require('../src/store/eventStore') as typeof import('../src/store/eventStore')).useEventStore.getState();
}

function controls(): typeof import('../src/habitTimer/habitTimerControls') {
  return require('../src/habitTimer/habitTimerControls');
}

function elements() {
  return (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore.getState();
}

function snapshotPath(): string {
  return `${mockFs.root}/widget/snapshot.json`;
}

function readSnapshot(): WidgetSnapshot {
  const { WidgetSnapshotSchema } = require('../src/protocol/widgetSnapshot') as typeof import('../src/protocol/widgetSnapshot');
  return WidgetSnapshotSchema.parse(JSON.parse(fs.readFileSync(snapshotPath(), 'utf8')));
}

/** Let the debounce window pass and the write land. */
async function settle(): Promise<void> {
  const landed = writer().requestWidgetSnapshot();
  jest.advanceTimersByTime(writer().WIDGET_SNAPSHOT_DEBOUNCE_MS);
  await landed;
}

function configOf(id: string): HabitConfig {
  const element = trackers.find((tracker) => tracker.id === id);
  if (element?.kind !== 'habit') throw new Error('not a habit');
  return element.config;
}

function trackerIn(snapshot: WidgetSnapshot, id: string) {
  const found = snapshot.trackers.find((tracker) => tracker.id === id);
  if (!found) throw new Error(`no tracker ${id}`);
  return found;
}

async function insertTick(id: string, date: string, eventId: string): Promise<void> {
  const eventRepo = require('../src/db/repositories/eventRepository') as typeof import('../src/db/repositories/eventRepository');
  const protocol = require('../src/protocol') as typeof import('../src/protocol');
  await eventRepo.insertEvent(testDb.db, {
    id: eventId,
    elementId: id,
    timestamp: `${date}T07:00:00.000Z`,
    date,
    value: 1,
    meta: { source: 'habit_tick' },
    protocolVersion: protocol.PROTOCOL_VERSION,
  });
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  mockFs = createFakeFileSystem();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  trackers = await seedRealisticTrackers(testDb.db);
  await elements().load();
  uninstall = writer().installWidgetSnapshotWriter();
});

afterEach(() => {
  uninstall();
  jest.useRealTimers();
  testDb.raw.close();
  mockFs.cleanup();
});

describe('the widget snapshot', () => {
  it('describes a realistic day, and stays small', async () => {
    await insertTick(TRACKERS.kefir, '2026-03-08', '550e8400-e29b-41d4-a716-446655441201');
    await insertTick(TRACKERS.kefir, '2026-03-09', '550e8400-e29b-41d4-a716-446655441202');
    await events().toggleHabit(TRACKERS.kefir, configOf(TRACKERS.kefir));
    for (let i = 0; i < 5; i += 1) await events().logEvent(TRACKERS.water, 1);
    await controls().pressHabitTimer(TRACKERS.breathing);
    jest.setSystemTime(new Date(2026, 2, 10, 9, 32));
    await settle();

    const snapshot = readSnapshot();
    expect(snapshot.version).toBe(3);
    // Written when the debounce window closes.
    expect(snapshot.generatedAt).toBe(new Date(2026, 2, 10, 9, 32, 0, 500).toISOString());
    expect(snapshot.day).toEqual({
      date: TODAY,
      endsAt: new Date(2026, 2, 11).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcOffsetMinutes: -new Date(2026, 2, 10, 9, 32).getTimezoneOffset(),
    });
    expect(snapshot.trackers.map((tracker) => tracker.id)).toEqual(Object.values(TRACKERS));

    expect(trackerIn(snapshot, TRACKERS.kefir)).toMatchObject({
      kind: 'habit',
      name: 'Burp the kefir',
      lockScreenName: null,
      dueToday: true,
      done: true,
      reason: 'checked',
      total: 1,
      streak: 3,
      unit: 'ticks',
      timer: null,
      sevenDays: [
        { date: '2026-03-04', state: 'not_done' },
        { date: '2026-03-05', state: 'not_done' },
        { date: '2026-03-06', state: 'not_done' },
        { date: '2026-03-07', state: 'not_done' },
        { date: '2026-03-08', state: 'done' },
        { date: '2026-03-09', state: 'done' },
        { date: TODAY, state: 'done' },
      ],
    });
    expect(trackerIn(snapshot, TRACKERS.meditation)).toMatchObject({
      lockScreenName: 'Sit',
      icon: 'meditation',
      done: false,
      reason: 'under_target',
      total: 0,
      target: 900,
      unit: 'seconds',
      timer: { goal: { type: 'seconds', seconds: 900 }, trackId: null, loop: true, session: null },
    });
    expect(trackerIn(snapshot, TRACKERS.breathing)).toMatchObject({
      timer: {
        goal: { type: 'seconds', seconds: 300 },
        session: {
          startedAt: NOW.toISOString(),
          pausedAt: null,
          pausedMs: 0,
          elapsedSeconds: 120,
          paused: false,
        },
      },
    });
    expect(trackerIn(snapshot, TRACKERS.mobility)).toMatchObject({
      dueToday: true,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
    });
    // 7 and 8 March 2026 are the weekend.
    expect(trackerIn(snapshot, TRACKERS.mobility).sevenDays.map(({ state }) => state)).toEqual([
      'not_done', 'not_done', 'not_done', 'not_due', 'not_due', 'not_done', 'not_done',
    ]);
    expect(trackerIn(snapshot, TRACKERS.face)).toMatchObject({
      timeRange: { start: '21:00', end: '23:00' },
      reminderTimes: ['20:45'],
    });
    expect(trackerIn(snapshot, TRACKERS.water)).toMatchObject({
      kind: 'counter',
      total: 5,
      target: 8,
      done: false,
      unit: 'glasses',
      quickIncrements: [1],
    });
    expect(trackerIn(snapshot, TRACKERS.coffee)).toMatchObject({ reason: 'no_target', target: null });
    // Kefir is done, so only the sprouts' evening rinse and the face routine are still to come.
    expect(snapshot.nextReminders).toEqual([
      { trackerId: TRACKERS.sprouts, time: '20:00', at: new Date(2026, 2, 10, 20, 0).toISOString() },
      { trackerId: TRACKERS.face, time: '20:45', at: new Date(2026, 2, 10, 20, 45).toISOString() },
    ]);
    expect(snapshot.commitment).toBeNull();
    expect(snapshot.ride).toBeNull();
    expect(JSON.stringify(snapshot)).not.toMatch(/journal|note/i);

    // 6.3 KB for these nine trackers (3.7 KB before the seven-day strips).
    expect(fs.statSync(snapshotPath()).size).toBeLessThan(7 * 1024);
  });

  it('calls a running timer past its goal done before it is logged', async () => {
    await controls().pressHabitTimer(TRACKERS.breathing);
    jest.setSystemTime(new Date(2026, 2, 10, 9, 36));
    await settle();

    expect(trackerIn(readSnapshot(), TRACKERS.breathing)).toMatchObject({
      done: true,
      reason: 'running_past_goal',
    });
  });

  it('is rewritten after a tick', async () => {
    await settle();
    expect(trackerIn(readSnapshot(), TRACKERS.creatine).done).toBe(false);

    await events().toggleHabit(TRACKERS.creatine, configOf(TRACKERS.creatine));
    await settle();

    expect(trackerIn(readSnapshot(), TRACKERS.creatine).done).toBe(true);
  });

  it('is rewritten after a timer start, pause and Done', async () => {
    const config = configOf(TRACKERS.meditation);
    const sessionOf = () => {
      const tracker = trackerIn(readSnapshot(), TRACKERS.meditation);
      return tracker.kind === 'habit' ? tracker.timer?.session : undefined;
    };

    await controls().pressHabitTimer(TRACKERS.meditation);
    await settle();
    expect(sessionOf()).toMatchObject({ paused: false });

    jest.setSystemTime(new Date(2026, 2, 10, 9, 40));
    await controls().pressHabitTimer(TRACKERS.meditation);
    await settle();
    expect(sessionOf()).toMatchObject({ paused: true, elapsedSeconds: 600 });

    await controls().markHabitTimerDone(TRACKERS.meditation, config);
    await settle();
    expect(sessionOf()).toBeNull();
    expect(trackerIn(readSnapshot(), TRACKERS.meditation)).toMatchObject({
      done: true,
      reason: 'marked_complete',
      total: 600,
    });
  });

  it('is rewritten after an edit and an archive', async () => {
    await settle();
    await elements().updateHabit(TRACKERS.creatine, {
      name: 'Creatine 5 g',
      lockScreenName: 'Pill',
    });
    await settle();
    expect(trackerIn(readSnapshot(), TRACKERS.creatine)).toMatchObject({
      name: 'Creatine 5 g',
      lockScreenName: 'Pill',
    });

    await elements().archiveElement(TRACKERS.coffee);
    await settle();
    expect(readSnapshot().trackers.map((tracker) => tracker.id)).not.toContain(TRACKERS.coffee);
  });

  it('is rewritten for the new day after midnight', async () => {
    await events().toggleHabit(TRACKERS.creatine, configOf(TRACKERS.creatine));
    await settle();

    jest.setSystemTime(new Date(2026, 2, 11, 0, 5));
    await (require('../src/hooks/refreshFromDb') as typeof import('../src/hooks/refreshFromDb')).refreshFromDb();
    await settle();

    const snapshot = readSnapshot();
    expect(snapshot.day.date).toBe('2026-03-11');
    expect(trackerIn(snapshot, TRACKERS.creatine)).toMatchObject({ done: false, streak: 1 });
  });

  it('never leaves a reader a half-written file', async () => {
    await settle();
    const target = `file://${snapshotPath()}`;
    for (let i = 0; i < 5; i += 1) {
      await events().logEvent(TRACKERS.water, 1);
      await settle();
      // Whole every time, and never written in place.
      expect(() => readSnapshot()).not.toThrow();
    }
    const fsModule = mockFs.module as { writeAsStringAsync: jest.Mock };
    expect(fsModule.writeAsStringAsync.mock.calls.map(([uri]) => uri)).not.toContain(target);
    expect(fs.readdirSync(`${mockFs.root}/widget`)).toEqual(['snapshot.json']);
  });

  it('turns a burst of changes into one write', async () => {
    await settle();
    const fsModule = mockFs.module as { moveAsync: jest.Mock };
    fsModule.moveAsync.mockClear();

    await events().toggleHabit(TRACKERS.creatine, configOf(TRACKERS.creatine));
    for (let i = 0; i < 4; i += 1) await events().logEvent(TRACKERS.water, 1);
    await controls().pressHabitTimer(TRACKERS.breathing);
    await settle();

    expect(fsModule.moveAsync).toHaveBeenCalledTimes(1);
    expect(trackerIn(readSnapshot(), TRACKERS.water).total).toBe(4);
  });

  it('is not rewritten when the core reports the timer unchanged', async () => {
    await controls().pressHabitTimer(TRACKERS.breathing);
    await settle();
    const fsModule = mockFs.module as { moveAsync: jest.Mock };
    fsModule.moveAsync.mockClear();
    const { lifeCore } = require('../src/core/lifeCore') as typeof import('../src/core/lifeCore');

    jest.setSystemTime(new Date(2026, 2, 10, 9, 31));
    await events().syncTimerFromCore(await lifeCore.getState());
    jest.advanceTimersByTime(writer().WIDGET_SNAPSHOT_DEBOUNCE_MS);
    await new Promise((resolve) => setImmediate(resolve));

    expect(fsModule.moveAsync).not.toHaveBeenCalled();
  });

  it('describes the commitment, its ride and its fortnight, and never a tracker name beside them', async () => {
    const protocol = require('../src/protocol') as typeof import('../src/protocol');
    const elementRepo = require('../src/db/repositories/elementRepository') as typeof import('../src/db/repositories/elementRepository');
    const eventRepo = require('../src/db/repositories/eventRepository') as typeof import('../src/db/repositories/eventRepository');
    const urgeRepo = require('../src/db/repositories/urgeRepository') as typeof import('../src/db/repositories/urgeRepository');
    const commitmentId = '550e8400-e29b-41d4-a716-446655441301';
    const slipAt = new Date(2026, 2, 7, 9, 30);
    await elementRepo.insertElementWithDashboardItem(
      testDb.db,
      {
        id: commitmentId,
        kind: 'commitment',
        name: 'No buying',
        config: protocol.CommitmentConfigSchema.parse({
          clearSince: slipAt.toISOString(),
          ownLines: ['Money for the trip', 'I sleep better'],
          // Kefir is not a timer and the second id is gone: both are left out.
          insteadHabitIds: [TRACKERS.meditation, '550e8400-e29b-41d4-a716-446655441399'],
        }),
        protocolVersion: protocol.PROTOCOL_VERSION,
        createdAt: '2026-01-01T08:00:00.000Z',
        archivedAt: null,
      },
      { id: '550e8400-e29b-41d4-a716-446655441302', elementId: commitmentId, sortOrder: 99 },
    );
    await eventRepo.insertEvent(testDb.db, {
      id: '550e8400-e29b-41d4-a716-446655441303',
      elementId: commitmentId,
      timestamp: slipAt.toISOString(),
      date: '2026-03-07',
      value: 1,
      meta: { source: 'slip' },
      protocolVersion: protocol.PROTOCOL_VERSION,
    });
    await urgeRepo.insertUrge(testDb.db, {
      id: '550e8400-e29b-41d4-a716-446655441304',
      at: new Date(2026, 2, 8, 21, 0).toISOString(),
      day: '2026-03-08',
      outcome: null,
      resolvedAt: null,
      source: 'widget',
    });
    const urgeStore = (require('../src/store/urgeStore') as typeof import('../src/store/urgeStore')).useUrgeStore;
    await elements().load();
    await urgeStore.getState().refresh();
    const open = await urgeStore.getState().logUrge();
    await settle();

    const snapshot = readSnapshot();
    expect(trackerIn(snapshot, commitmentId)).toMatchObject({
      kind: 'commitment',
      lockScreenName: 'Clear',
      dueToday: true,
      done: true,
      reason: 'clear',
      total: 0,
      streak: 3,
      unit: 'slips',
    });
    expect(snapshot.commitment).toEqual({
      id: commitmentId,
      lockScreenName: 'Clear',
      clearSince: slipAt.toISOString(),
      // Exactly 72 hours: the 3-day lamp is passed.
      lampsPassed: 3,
      nextLamp: { at: new Date(2026, 2, 12, 9, 30).toISOString(), hours: 120, label: '5d' },
      // All of them, so the widget can move to the next one at a lamp by itself.
      ownLines: ['Money for the trip', 'I sleep better'],
      rideSeconds: 600,
      urgesRiddenOut: 1,
      urgesToday: 1,
      insteadHabits: [{ id: TRACKERS.meditation, lockScreenName: 'Sit', icon: 'meditation', goalSeconds: 900 }],
      days: [
        ...Array.from({ length: 10 }, (_, index) => ({
          date: `2026-0${index < 4 ? '2' : '3'}-${String(index < 4 ? 25 + index : index - 3).padStart(2, '0')}`,
          state: 'done',
        })),
        { date: '2026-03-07', state: 'slip' },
        { date: '2026-03-08', state: 'done' },
        { date: '2026-03-09', state: 'done' },
        { date: TODAY, state: 'done' },
      ],
    });
    expect(snapshot.ride).toEqual({
      urgeId: open,
      startedAt: NOW.toISOString(),
      endsAt: new Date(2026, 2, 10, 9, 40).toISOString(),
    });
    // The real name is in the tracker list, marked never for the lock screen; nowhere else.
    expect(JSON.stringify({ ...snapshot, trackers: [] })).not.toContain('No buying');
    // 7.8 KB with the commitment, its fortnight and an open ride.
    expect(fs.statSync(snapshotPath()).size).toBeLessThan(8 * 1024);

    await urgeStore.getState().resolveUrge(open!, 'used');
    await settle();
    expect(readSnapshot().ride).toBeNull();
  });
});
