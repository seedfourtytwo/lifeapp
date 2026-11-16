/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * "Skip today" against real SQL (node:sqlite), through the repository and the
 * event store: a skip is a value-0 `{ source: 'skip' }` row, at most one per
 * day, and every write that touches the day keeps that true.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../src/db/client';
import { PERSISTED_CONCEPTS } from '../src/db/persistedConcepts';
import * as eventRepo from '../src/db/repositories/eventRepository';
import { resetDataGenerationsForTests } from '../src/db/dataGeneration';
import { useElementStore } from '../src/store/elementStore';
import { isSkippedToday, useEventStore } from '../src/store/eventStore';
import { resetWriteEpochsForTests } from '../src/store/writeEpoch';
import {
  CounterConfigSchema,
  isHabitDayComplete,
  parseHabitConfig,
  PROTOCOL_VERSION,
  type ElementDefinition,
  type LifeEvent,
} from '../src/protocol';
import { currentAppCalendarDate } from '../src/utils/dayRollover';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../src/store/habitStreakFetch', () => ({
  loadHabitStreakForElement: jest.fn(async () => ({ streak: 0, failureStreak: 0, score: 40 })),
  loadHabitStreakMaps: jest.fn(async () => ({ streaks: {}, failureStreaks: {}, scores: {} })),
}));

jest.mock('../src/store/counterStreakFetch', () => ({
  loadCounterStreakForElement: jest.fn(async () => ({ streak: 0, score: 0 })),
  loadCounterStreakMaps: jest.fn(async () => ({ streaks: {}, scores: {} })),
}));

jest.mock('../src/utils/habitHaptics', () => ({
  playHabitCompleteHaptic: jest.fn(async () => undefined),
}));

jest.mock('../src/audio/habitCompleteSound', () => ({
  playHabitCompleteChime: jest.fn(async () => undefined),
}));

type Bind = null | number | string;

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
const habitConfig = parseHabitConfig({ trackingMode: 'boolean' });
const counterConfig = CounterConfigSchema.parse({
  unit: 'reps',
  quickIncrements: [10],
  dailyTarget: 50,
});
const habitComplete = (total: number, events: readonly LifeEvent[]) =>
  isHabitDayComplete(total, habitConfig, events);

let idSeq = 0;
function uuid(): string {
  idSeq += 1;
  return `00000000-0000-4000-8000-${String(idSeq).padStart(12, '0')}`;
}

let dir: string;
let raw: DatabaseSync;
let db: SQLiteDatabase;

/** A row as the Kotlin widget would write it, on the same file. */
function rawInsert(elementId: string, value: number, meta: unknown, date = DATE): void {
  raw
    .prepare(
      `INSERT INTO events (id, element_id, timestamp, date, value, meta_json, protocol_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      uuid(),
      elementId,
      `${date}T08:00:00.000Z`,
      date,
      value,
      meta === null ? null : typeof meta === 'string' ? meta : JSON.stringify(meta),
      PROTOCOL_VERSION,
    );
}

function rows(elementId: string, date = DATE): { value: number; meta_json: string | null }[] {
  return raw
    .prepare('SELECT value, meta_json FROM events WHERE element_id = ? AND date = ? ORDER BY rowid')
    .all(elementId, date) as { value: number; meta_json: string | null }[];
}

const skipRows = (elementId: string, date = DATE) =>
  rows(elementId, date).filter((row) => row.meta_json?.includes('"skip"'));

function skip(elementId: string, wantSkip: boolean, isComplete = habitComplete) {
  return eventRepo.applySkipDayIntent(db, {
    elementId,
    date: DATE,
    skip: wantSkip,
    isComplete,
    newEvent: { id: uuid(), timestamp: `${DATE}T09:00:00.000Z` },
  });
}

beforeEach(() => {
  idSeq = 0;
  dir = mkdtempSync(join(tmpdir(), 'skip-day-'));
  raw = new DatabaseSync(join(dir, 'lifeapp.db'), { enableForeignKeyConstraints: false });
  raw.exec(EVENTS_DDL);
  db = wrap(raw);
});

afterEach(() => {
  raw.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('applySkipDayIntent', () => {
  it('writes one value-0 skip row', async () => {
    await expect(skip(HABIT, true)).resolves.toMatchObject({
      skipped: true,
      hasSkipRow: true,
      changed: true,
    });
    expect(rows(HABIT)).toEqual([{ value: 0, meta_json: '{"source":"skip"}' }]);
  });

  it('never writes a second skip row', async () => {
    await skip(HABIT, true);
    await expect(skip(HABIT, true)).resolves.toMatchObject({ skipped: true, changed: false });
    expect(skipRows(HABIT)).toHaveLength(1);
  });

  it('does not skip a complete day', async () => {
    rawInsert(HABIT, 1, { source: 'habit_tick' });
    await expect(skip(HABIT, true)).resolves.toMatchObject({ skipped: false, changed: false });
    expect(skipRows(HABIT)).toEqual([]);
  });

  it('unskip removes only the skip row', async () => {
    const isComplete = (total: number) => total >= 50;
    rawInsert(COUNTER, 20, { source: 'quick_button', increment: 20 });
    await skip(COUNTER, true, isComplete);
    await expect(skip(COUNTER, false, isComplete)).resolves.toMatchObject({
      skipped: false,
      hasSkipRow: false,
      changed: true,
    });
    expect(rows(COUNTER)).toEqual([
      { value: 20, meta_json: '{"source":"quick_button","increment":20}' },
    ]);
  });

  it('recognises a skip row the widget wrote with different JSON spacing', async () => {
    rawInsert(HABIT, 0, '{ "source" : "skip" }');
    await expect(skip(HABIT, true)).resolves.toMatchObject({ skipped: true, changed: false });
    const states = await eventRepo.getDayStatesForElementsOnDate(db, [HABIT], DATE);
    expect(states.get(HABIT)).toEqual({ total: 0, skipped: true });
  });
});

describe('writes that share a day with a skip row', () => {
  it('a tick on a skipped day adds the tick and removes the skip', async () => {
    await skip(HABIT, true);
    const day = await eventRepo.applyHabitDayIntent(db, {
      elementId: HABIT,
      date: DATE,
      done: true,
      config: habitConfig,
      newEvent: { id: uuid(), timestamp: `${DATE}T10:00:00.000Z`, meta: { source: 'habit_tick' } },
    });
    expect(day).toMatchObject({ done: true, total: 1, changed: true });
    expect(day.events.map((event) => event.meta?.source)).toEqual(['habit_tick']);
    expect(rows(HABIT)).toEqual([{ value: 1, meta_json: '{"source":"habit_tick"}' }]);
  });

  it('an untick returns the day to plain "not done", skip row included', async () => {
    rawInsert(HABIT, 1, { source: 'habit_tick' });
    rawInsert(HABIT, 0, { source: 'skip' });
    await eventRepo.applyHabitDayIntent(db, {
      elementId: HABIT,
      date: DATE,
      done: false,
      config: habitConfig,
      newEvent: { id: uuid(), timestamp: `${DATE}T10:00:00.000Z` },
    });
    expect(rows(HABIT)).toEqual([]);
  });

  it('a counter set-total keeps the skip row, neither dropped nor doubled', async () => {
    rawInsert(COUNTER, 10, { source: 'quick_button' });
    rawInsert(COUNTER, 0, { source: 'skip' });
    rawInsert(COUNTER, 5, { source: 'quick_button' });
    await eventRepo.setDailyTotalForElement(db, COUNTER, DATE, 30, {
      id: uuid(),
      timestamp: `${DATE}T10:00:00.000Z`,
      meta: { source: 'manual' },
    });
    expect(skipRows(COUNTER)).toHaveLength(1);
    expect(rows(COUNTER).reduce((sum, row) => sum + row.value, 0)).toBe(30);

    await eventRepo.adjustDailyTotalForElement(db, COUNTER, DATE, -30, {
      id: uuid(),
      timestamp: `${DATE}T11:00:00.000Z`,
      meta: { source: 'manual' },
    });
    // Back to zero: only the skip row is left.
    expect(rows(COUNTER)).toEqual([{ value: 0, meta_json: '{"source":"skip"}' }]);
  });

  it('a skip row alone does not block restoring a reset day, and is not doubled', async () => {
    rawInsert(HABIT, 0, { source: 'skip' });
    rawInsert(HABIT, 300, null);
    const taken = await eventRepo.takeEventsForElementOnDate(db, HABIT, DATE);
    rawInsert(HABIT, 0, { source: 'skip' });
    await expect(eventRepo.restoreEventsIfDayEmpty(db, HABIT, DATE, taken)).resolves.toBe(true);
    expect(skipRows(HABIT)).toHaveLength(1);
    expect(rows(HABIT).reduce((sum, row) => sum + row.value, 0)).toBe(300);
  });

  it('a real log since the reset still blocks the restore', async () => {
    rawInsert(HABIT, 300, null);
    const taken = await eventRepo.takeEventsForElementOnDate(db, HABIT, DATE);
    rawInsert(HABIT, 60, null);
    await expect(eventRepo.restoreEventsIfDayEmpty(db, HABIT, DATE, taken)).resolves.toBe(false);
  });
});

describe('aggregates see a skip without counting it', () => {
  it('daily totals carry a skip flag and a zero contribution', async () => {
    rawInsert(COUNTER, 20, { source: 'quick_button' });
    rawInsert(COUNTER, 0, { source: 'skip' });
    rawInsert(COUNTER, 40, null, '2026-11-15');
    const byElement = await eventRepo.getDailyTotalsForElementsSince(db, [COUNTER], '2026-11-01');
    expect(byElement.get(COUNTER)).toEqual([
      { date: '2026-11-15', total: 40, skipped: false },
      { date: DATE, total: 20, skipped: true },
    ]);
    await expect(eventRepo.getDailyTotal(db, COUNTER, DATE)).resolves.toBe(20);
  });

  it('a set-total still clears a row whose meta is corrupt', async () => {
    rawInsert(COUNTER, 7, '{not json');
    await eventRepo.setDailyTotalForElement(db, COUNTER, DATE, 30, {
      id: uuid(),
      timestamp: `${DATE}T10:00:00.000Z`,
    });
    await expect(eventRepo.getDailyTotal(db, COUNTER, DATE)).resolves.toBe(30);
  });

  it('one corrupt meta string does not fail the aggregate', async () => {
    rawInsert(COUNTER, 7, '{not json');
    const byElement = await eventRepo.getDailyTotalsForElementsSince(db, [COUNTER], '2026-11-01');
    expect(byElement.get(COUNTER)).toEqual([{ date: DATE, total: 7, skipped: false }]);
  });
});

describe('eventStore.setSkipToday', () => {
  const today = () => currentAppCalendarDate();
  const habitElement: ElementDefinition = {
    id: HABIT,
    kind: 'habit',
    name: 'Stretch',
    config: { trackingMode: 'boolean' },
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const counterElement: ElementDefinition = {
    id: COUNTER,
    kind: 'counter',
    name: 'Push-ups',
    config: counterConfig,
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    resetWriteEpochsForTests();
    resetDataGenerationsForTests();
    (getDatabase as jest.Mock).mockResolvedValue(db);
    await useEventStore.getState().reset();
    useElementStore.setState({
      elements: [habitElement, counterElement],
      dashboard: [],
      isLoaded: true,
      isLoading: false,
    });
  });

  it('skips and un-skips a habit, refreshing its score', async () => {
    await useEventStore.getState().setSkipToday(HABIT, { kind: 'habit', config: habitConfig }, true);
    expect(skipRows(HABIT, today())).toHaveLength(1);
    expect(isSkippedToday(useEventStore.getState(), HABIT, false)).toBe(true);
    expect(useEventStore.getState().habitScores[HABIT]).toBe(40);

    await useEventStore.getState().setSkipToday(HABIT, { kind: 'habit', config: habitConfig }, false);
    expect(skipRows(HABIT, today())).toEqual([]);
    expect(isSkippedToday(useEventStore.getState(), HABIT, false)).toBe(false);
  });

  it('ticking a skipped habit clears the skip in the store too', async () => {
    await useEventStore.getState().setSkipToday(HABIT, { kind: 'habit', config: habitConfig }, true);
    useEventStore.setState({ dayStateReady: true });
    await useEventStore.getState().toggleHabit(HABIT, habitConfig);
    expect(useEventStore.getState().skipRowToday[HABIT]).toBe(false);
    expect(useEventStore.getState().habitDoneToday[HABIT]).toBe(true);
    expect(skipRows(HABIT, today())).toEqual([]);
  });

  it('loads a skip the widget wrote into the day state', async () => {
    rawInsert(HABIT, 0, { source: 'skip' }, today());
    rawInsert(COUNTER, 0, { source: 'skip' }, today());
    await useEventStore
      .getState()
      .loadHabitDayState([{ id: HABIT, config: habitConfig, createdAt: null }]);
    await useEventStore.getState().loadCounterTotals([COUNTER]);
    const state = useEventStore.getState();
    expect(state.skipRowToday).toEqual({ [HABIT]: true, [COUNTER]: true });
    expect(state.habitDoneToday[HABIT]).toBe(false);
    expect(state.dailyTotals[COUNTER]).toBe(0);
  });

  it('loads this week’s done days for a times-a-week habit', async () => {
    const weekly = parseHabitConfig({ schedule: { type: 'times_per_week', times: 2 } });
    // 2026-11-18 is a Wednesday; the week started Monday the 16th.
    rawInsert(HABIT, 1, { source: 'habit_tick' }, '2026-11-16');
    rawInsert(HABIT, 1, { source: 'habit_tick' }, '2026-11-15');
    await useEventStore
      .getState()
      .loadHabitDayState([{ id: HABIT, config: weekly, createdAt: null }], '2026-11-18');
    expect(useEventStore.getState().habitWeekDoneBefore[HABIT]).toEqual(['2026-11-16']);
  });
});
