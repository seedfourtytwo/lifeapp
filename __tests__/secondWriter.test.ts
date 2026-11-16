/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * The app shares its SQLite file with a second writer (the Android home-screen
 * widget, on its own connection). These run real SQL against a real file with
 * two `node:sqlite` connections: "app" goes through the repository, "widget"
 * writes underneath it.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../src/db/client';
import { readDataVersion } from '../src/db/dataVersion';
import { withImmediateTransaction } from '../src/db/immediateTransaction';
import { PERSISTED_CONCEPTS } from '../src/db/persistedConcepts';
import * as eventRepo from '../src/db/repositories/eventRepository';
import { resetDataGenerationsForTests } from '../src/db/dataGeneration';
import { refreshTodayFromDb, resetTodayRefreshForTests } from '../src/hooks/refreshAllDailyData';
import { useElementStore } from '../src/store/elementStore';
import { useEventStore } from '../src/store/eventStore';
import { resetWriteEpochsForTests } from '../src/store/writeEpoch';
import {
  parseHabitConfig,
  PROTOCOL_VERSION,
  type ElementDefinition,
  type HabitConfig,
} from '../src/protocol';
import { currentAppCalendarDate } from '../src/utils/dayRollover';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../src/store/habitStreakFetch', () => ({
  loadHabitStreakForElement: jest.fn(async () => ({ streak: 1, failureStreak: 0 })),
  loadHabitStreakMaps: jest.fn(async () => ({ streaks: {}, failureStreaks: {} })),
}));

jest.mock('../src/store/counterStreakFetch', () => ({
  loadCounterStreakForElement: jest.fn(async () => 0),
  loadCounterStreakMaps: jest.fn(async () => ({})),
}));

jest.mock('../src/utils/habitHaptics', () => ({
  playHabitCompleteHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/audio/habitCompleteSound', () => ({
  playHabitCompleteChime: jest.fn(async () => undefined),
}));

type Bind = null | number | string;

/** An expo-sqlite-shaped wrapper over one real connection. */
function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: Bind[]) =>
      raw.prepare(sql).get(...params) ?? null,
  } as unknown as SQLiteDatabase;
}

const EVENTS_DDL = PERSISTED_CONCEPTS.find((concept) => concept.name === 'events')!.ddl;
const HABIT = '00000000-0000-4000-8000-00000000000a';
const COUNTER = '00000000-0000-4000-8000-00000000000c';
const DATE = '2026-11-16';
const habitConfig: HabitConfig = parseHabitConfig({ trackingMode: 'boolean' });

let idSeq = 0;
function uuid(): string {
  idSeq += 1;
  return `00000000-0000-4000-8000-${String(idSeq).padStart(12, '0')}`;
}

let dir: string;
let appRaw: DatabaseSync;
let widgetRaw: DatabaseSync;
let app: SQLiteDatabase;

/** The widget's write, on its own connection. */
function widgetInsert(elementId: string, value: number, date = DATE): void {
  widgetRaw
    .prepare(
      `INSERT INTO events (id, element_id, timestamp, date, value, meta_json, protocol_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(uuid(), elementId, `${date}T08:00:00.000Z`, date, value, null, PROTOCOL_VERSION);
}

function rowsFor(elementId: string, date = DATE): { id: string; value: number }[] {
  return widgetRaw
    .prepare('SELECT id, value FROM events WHERE element_id = ? AND date = ?')
    .all(elementId, date) as { id: string; value: number }[];
}

function stub() {
  return { id: uuid(), timestamp: `${DATE}T09:00:00.000Z`, meta: { source: 'test' } };
}

beforeEach(() => {
  idSeq = 0;
  dir = mkdtempSync(join(tmpdir(), 'second-writer-'));
  const file = join(dir, 'lifeapp.db');
  // No elements table here; node:sqlite enforces foreign keys by default.
  appRaw = new DatabaseSync(file, { enableForeignKeyConstraints: false });
  appRaw.exec('PRAGMA journal_mode = WAL;');
  appRaw.exec(EVENTS_DDL);
  widgetRaw = new DatabaseSync(file, { enableForeignKeyConstraints: false });
  widgetRaw.exec('PRAGMA busy_timeout = 0;');
  app = wrap(appRaw);
});

afterEach(() => {
  appRaw.close();
  widgetRaw.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('applyHabitDayIntent', () => {
  it('ticks an empty day with one event', async () => {
    const day = await eventRepo.applyHabitDayIntent(app, {
      elementId: HABIT,
      date: DATE,
      done: true,
      config: habitConfig,
      newEvent: stub(),
    });
    expect(day).toMatchObject({ done: true, total: 1, changed: true });
    expect(rowsFor(HABIT)).toHaveLength(1);
  });

  it('UI said not done, the widget already ticked: stays at one event', async () => {
    widgetInsert(HABIT, 1);
    const day = await eventRepo.applyHabitDayIntent(app, {
      elementId: HABIT,
      date: DATE,
      done: true,
      config: habitConfig,
      newEvent: stub(),
    });
    expect(day).toMatchObject({ done: true, total: 1, changed: false });
    expect(rowsFor(HABIT)).toHaveLength(1);
  });

  it('UI said done, the widget already cleared the day: no error, stays empty', async () => {
    const day = await eventRepo.applyHabitDayIntent(app, {
      elementId: HABIT,
      date: DATE,
      done: false,
      config: habitConfig,
      newEvent: stub(),
    });
    expect(day).toMatchObject({ done: false, total: 0, changed: false });
    expect(rowsFor(HABIT)).toEqual([]);
  });

  it('unticks a done day', async () => {
    widgetInsert(HABIT, 1);
    const day = await eventRepo.applyHabitDayIntent(app, {
      elementId: HABIT,
      date: DATE,
      done: false,
      config: habitConfig,
      newEvent: stub(),
    });
    expect(day).toMatchObject({ done: false, total: 0, changed: true });
    expect(rowsFor(HABIT)).toEqual([]);
  });

  it('fails cleanly, leaving no transaction open, when another connection holds the write lock', async () => {
    appRaw.exec('PRAGMA busy_timeout = 0;');
    widgetRaw.exec('BEGIN IMMEDIATE');
    await expect(
      eventRepo.applyHabitDayIntent(app, {
        elementId: HABIT,
        date: DATE,
        done: true,
        config: habitConfig,
        newEvent: stub(),
      }),
    ).rejects.toThrow(/locked|busy/i);
    widgetRaw.exec('ROLLBACK');
    // Nothing half-applied, and the connection is not left inside a transaction.
    expect(rowsFor(HABIT)).toEqual([]);
    await expect(
      eventRepo.applyHabitDayIntent(app, {
        elementId: HABIT,
        date: DATE,
        done: true,
        config: habitConfig,
        newEvent: stub(),
      }),
    ).resolves.toMatchObject({ done: true, changed: true });
  });
});

describe('withImmediateTransaction', () => {
  it('rolls back everything when the task throws', async () => {
    await expect(
      withImmediateTransaction(app, async () => {
        await eventRepo.insertEvent(app, {
          id: uuid(),
          elementId: HABIT,
          timestamp: `${DATE}T09:00:00.000Z`,
          date: DATE,
          value: 1,
          protocolVersion: PROTOCOL_VERSION,
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(rowsFor(HABIT)).toEqual([]);
  });

  it('holds the write lock from the start, so the other connection cannot write mid-read', async () => {
    await withImmediateTransaction(app, async () => {
      expect(() => widgetInsert(HABIT, 1)).toThrow(/locked|busy/i);
    });
    widgetInsert(HABIT, 1);
    expect(rowsFor(HABIT)).toHaveLength(1);
  });
});

describe('counter day writes', () => {
  it('undo takes back only its own taps and keeps the widget’s +1', async () => {
    // App: 4 before the burst, then +3 from taps; widget adds +1 afterwards.
    await eventRepo.insertEvent(app, {
      id: uuid(),
      elementId: COUNTER,
      timestamp: `${DATE}T07:00:00.000Z`,
      date: DATE,
      value: 7,
      protocolVersion: PROTOCOL_VERSION,
    });
    widgetInsert(COUNTER, 1);
    const total = await eventRepo.adjustDailyTotalForElement(app, COUNTER, DATE, -3, stub());
    expect(total).toBe(5);
    expect(rowsFor(COUNTER).reduce((sum, row) => sum + row.value, 0)).toBe(5);
  });

  it('undo clamps at zero when someone already cleared the day', async () => {
    const total = await eventRepo.adjustDailyTotalForElement(app, COUNTER, DATE, -3, stub());
    expect(total).toBe(0);
    expect(rowsFor(COUNTER)).toEqual([]);
  });

  it('set total leaves the day alone when SQLite already holds that total', async () => {
    widgetInsert(COUNTER, 2);
    widgetInsert(COUNTER, 3);
    const before = rowsFor(COUNTER).map((row) => row.id).sort();
    await expect(
      eventRepo.setDailyTotalForElement(app, COUNTER, DATE, 5, stub()),
    ).resolves.toBe(5);
    expect(rowsFor(COUNTER).map((row) => row.id).sort()).toEqual(before);
  });

  it('set total collapses the day when it differs', async () => {
    widgetInsert(COUNTER, 2);
    await expect(
      eventRepo.setDailyTotalForElement(app, COUNTER, DATE, 9, stub()),
    ).resolves.toBe(9);
    expect(rowsFor(COUNTER).map((row) => row.value)).toEqual([9]);
  });
});

describe('habit day clear and undo', () => {
  it('take returns exactly what it deleted', async () => {
    widgetInsert(HABIT, 30);
    widgetInsert(HABIT, 45);
    const taken = await eventRepo.takeEventsForElementOnDate(app, HABIT, DATE);
    expect(taken.map((event) => event.value).sort()).toEqual([30, 45]);
    expect(rowsFor(HABIT)).toEqual([]);
  });

  it('restore refuses a day another writer logged on since', async () => {
    widgetInsert(HABIT, 30);
    const taken = await eventRepo.takeEventsForElementOnDate(app, HABIT, DATE);
    widgetInsert(HABIT, 1);
    await expect(eventRepo.restoreEventsIfDayEmpty(app, HABIT, DATE, taken)).resolves.toBe(
      false,
    );
    expect(rowsFor(HABIT).map((row) => row.value)).toEqual([1]);
  });
});

describe('readDataVersion', () => {
  it('moves on another connection’s commit, not on this connection’s own', async () => {
    const start = await readDataVersion(app);
    await eventRepo.insertEvent(app, {
      id: uuid(),
      elementId: HABIT,
      timestamp: `${DATE}T09:00:00.000Z`,
      date: DATE,
      value: 1,
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(await readDataVersion(app)).toBe(start);
    widgetInsert(HABIT, 1);
    expect(await readDataVersion(app)).not.toBe(start);
  });
});

describe('eventStore against a second writer', () => {
  const today = () => currentAppCalendarDate();
  const habitElement: ElementDefinition = {
    id: HABIT,
    kind: 'habit',
    name: 'Stretch',
    config: { trackingMode: 'boolean' },
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    resetWriteEpochsForTests();
    resetDataGenerationsForTests();
    resetTodayRefreshForTests();
    (getDatabase as jest.Mock).mockResolvedValue(app);
    await useEventStore.getState().reset();
    useElementStore.setState({
      elements: [habitElement],
      dashboard: [],
      isLoaded: true,
      isLoading: false,
    });
  });

  it('a tick the widget already wrote is reconciled, not doubled', async () => {
    widgetInsert(HABIT, 1, today());
    useEventStore.setState({ habitDoneToday: { [HABIT]: false }, dayStateReady: true });

    await useEventStore.getState().toggleHabit(HABIT, habitConfig);

    expect(rowsFor(HABIT, today())).toHaveLength(1);
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(true);
    expect(useEventStore.getState().dailyTotals[HABIT]).toBe(1);
    expect(useEventStore.getState().habitStreaks[HABIT]).toBe(1);
  });

  it('an untick of a day the widget already cleared settles on not done', async () => {
    useEventStore.setState({
      habitDoneToday: { [HABIT]: true },
      dailyTotals: { [HABIT]: 1 },
      dayStateReady: true,
    });

    await useEventStore.getState().toggleHabit(HABIT, habitConfig);

    expect(rowsFor(HABIT, today())).toEqual([]);
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(false);
  });

  it('refreshTodayFromDb picks up the widget’s write, and skips when nothing changed', async () => {
    const getAll = jest.spyOn(app, 'getAllAsync');
    await refreshTodayFromDb();
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(false);

    getAll.mockClear();
    await refreshTodayFromDb();
    expect(getAll).not.toHaveBeenCalled();

    widgetInsert(HABIT, 1, today());
    await refreshTodayFromDb();
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(true);
  });

  it('refreshTodayFromDb does not paint over a tick still in flight', async () => {
    widgetInsert(HABIT, 1, today());
    useEventStore.setState({ habitDoneToday: { [HABIT]: true }, dailyTotals: { [HABIT]: 1 } });
    // Hold the app's write lock so the untick sits between optimistic and commit.
    const { withDbWriteLock } = jest.requireActual<typeof import('../src/db/writeLock')>(
      '../src/db/writeLock',
    );
    let releaseLock!: () => void;
    const held = withDbWriteLock(
      () =>
        new Promise<void>((resolve) => {
          releaseLock = resolve;
        }),
    );
    const untick = useEventStore.getState().toggleHabit(HABIT, habitConfig);
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(false);

    await refreshTodayFromDb({ force: true });
    // SQLite still says done, but the optimistic untick is what stays on screen.
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(false);

    releaseLock();
    await held;
    await untick;
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(false);
    expect(rowsFor(HABIT, today())).toEqual([]);
  });
});
