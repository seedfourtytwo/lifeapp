/**
 * Review's one aggregate read, against real SQL (node:sqlite): per tracker and
 * day the SUM, a skip flag and a finished-track flag — enough for the day rules,
 * play-once timer habits included, without loading event rows.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { PERSISTED_CONCEPTS } from '../src/db/persistedConcepts';
import * as eventRepo from '../src/db/repositories/eventRepository';
import { PROTOCOL_VERSION, shiftDateString, type ElementDefinition } from '../src/protocol';
import { loadReviewData, reviewDayStates } from '../src/review';

type Bind = null | number | string;

const EVENTS_DDL = PERSISTED_CONCEPTS.find((concept) => concept.name === 'events')!.ddl;
const TODAY = '2026-11-18';
const ID = {
  tick: '00000000-0000-4000-8000-0000000000a1',
  playOnce: '00000000-0000-4000-8000-0000000000a2',
  target: '00000000-0000-4000-8000-0000000000c1',
  tally: '00000000-0000-4000-8000-0000000000c2',
};

let dir: string;
let raw: DatabaseSync;
let db: SQLiteDatabase;
let reads: number;
let seq = 0;

function wrap(source: DatabaseSync): SQLiteDatabase {
  return {
    getAllAsync: async (sql: string, ...params: Bind[]) => {
      reads++;
      return source.prepare(sql).all(...params);
    },
  } as unknown as SQLiteDatabase;
}

function insert(elementId: string, date: string, value: number, meta: unknown = null): void {
  seq++;
  raw
    .prepare(
      `INSERT INTO events (id, element_id, timestamp, date, value, meta_json, protocol_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
      elementId,
      `${date}T08:00:00.000Z`,
      date,
      value,
      meta === null ? null : typeof meta === 'string' ? meta : JSON.stringify(meta),
      PROTOCOL_VERSION,
    );
}

const session = (trackCompleted?: boolean) => ({
  source: 'timer_session',
  startedAt: '2026-11-10T08:00:00.000Z',
  endedAt: '2026-11-10T08:05:00.000Z',
  durationSeconds: 300,
  ...(trackCompleted === undefined ? {} : { trackCompleted }),
});

const element = (id: string, kind: ElementDefinition['kind'], config: Record<string, unknown>): ElementDefinition => ({
  id,
  kind,
  name: id,
  config,
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2026-11-10T09:00:00.000Z',
});

const ELEMENTS: ElementDefinition[] = [
  element(ID.playOnce, 'habit', {
    trackingMode: 'timer',
    timerSound: { trackId: 'meditation15min', playbackMode: 'play_once' },
  }),
  element(ID.tick, 'habit', { trackingMode: 'boolean' }),
  element(ID.target, 'counter', { unit: 'reps', quickIncrements: [5], dailyTarget: 10 }),
  element(ID.tally, 'counter', { unit: 'cups', quickIncrements: [1] }),
];

beforeEach(() => {
  reads = 0;
  dir = mkdtempSync(join(tmpdir(), 'review-load-'));
  raw = new DatabaseSync(join(dir, 'lifeapp.db'), { enableForeignKeyConstraints: false });
  raw.exec(EVENTS_DDL);
  db = wrap(raw);
});

afterEach(() => {
  raw.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('getDayFactsForElementsSince', () => {
  it('reads SUM, skip and finished-track flags per element and day in one query', async () => {
    insert(ID.playOnce, '2026-11-10', 300, session(true));
    insert(ID.playOnce, '2026-11-10', 120, session());
    insert(ID.playOnce, '2026-11-11', 300, session(false));
    insert(ID.tick, '2026-11-11', 0, { source: 'skip' });
    insert(ID.tick, '2026-11-12', 1, '{not json');
    insert(ID.tick, '2026-11-01', 1, { source: 'habit_tick' });

    const facts = await eventRepo.getDayFactsForElementsSince(db, [ID.playOnce, ID.tick, ID.target], '2026-11-05');
    expect(reads).toBe(1);
    expect(facts.get(ID.playOnce)).toEqual([
      { date: '2026-11-10', total: 420, skipped: false, trackCompleted: true },
      { date: '2026-11-11', total: 300, skipped: false, trackCompleted: false },
    ]);
    expect(facts.get(ID.tick)).toEqual([
      { date: '2026-11-11', total: 0, skipped: true, trackCompleted: false },
      { date: '2026-11-12', total: 1, skipped: false, trackCompleted: false },
    ]);
    expect(facts.get(ID.target)).toEqual([]);
  });

  it('reads nothing for no elements', async () => {
    await expect(eventRepo.getDayFactsForElementsSince(db, [], '2026-11-01')).resolves.toEqual(new Map());
    expect(reads).toBe(0);
  });

  it('leaves getDailyTotalsForElementsSince its own shape', async () => {
    insert(ID.playOnce, '2026-11-10', 300, session(true));
    const totals = await eventRepo.getDailyTotalsForElementsSince(db, [ID.playOnce], '2026-11-01');
    expect(totals.get(ID.playOnce)).toEqual([{ date: '2026-11-10', total: 300, skipped: false }]);
  });
});

describe('loadReviewData', () => {
  it('returns every tracker in the given order from one read', async () => {
    const data = await loadReviewData(db, { elements: ELEMENTS, days: 14, today: TODAY });
    expect(reads).toBe(1);
    expect(data.map((d) => d.tracker.id)).toEqual([ID.playOnce, ID.tick, ID.target, ID.tally]);
    expect(data.every((d) => d.tracker.createdOn === '2026-11-10')).toBe(true);
    expect(await loadReviewData(db, { elements: [], days: 14, today: TODAY })).toEqual([]);
  });

  it('completes a play-once timer day only through a finished track', async () => {
    insert(ID.playOnce, '2026-11-15', 300, session(true));
    insert(ID.playOnce, '2026-11-16', 900, session());
    const [playOnce] = await loadReviewData(db, { elements: ELEMENTS, days: 14, today: TODAY });
    const states = reviewDayStates(playOnce.tracker, playOnce.history, ['2026-11-15', '2026-11-16'], TODAY);
    expect(states.map((d) => d.state)).toEqual(['done', 'missed']);
  });

  it('applies each tracker its own completion rule and skip', async () => {
    insert(ID.tick, '2026-11-16', 1, { source: 'habit_tick' });
    insert(ID.tick, '2026-11-17', 0, { source: 'skip' });
    insert(ID.target, '2026-11-16', 5);
    insert(ID.target, '2026-11-17', 10);
    insert(ID.tally, '2026-11-16', 2);
    const dates = ['2026-11-16', '2026-11-17'];
    const data = await loadReviewData(db, { elements: ELEMENTS, days: 14, today: TODAY });
    const byId = new Map(data.map((d) => [d.tracker.id, reviewDayStates(d.tracker, d.history, dates, TODAY)]));
    expect(byId.get(ID.tick)?.map((d) => d.state)).toEqual(['done', 'skipped']);
    expect(byId.get(ID.target)?.map((d) => d.state)).toEqual(['missed', 'done']);
    expect(byId.get(ID.tally)?.map((d) => d.state)).toEqual(['done', 'none']);
  });

  it('always loads the strength lookback and the whole first week', async () => {
    const old = shiftDateString(TODAY, -390);
    insert(ID.tick, old, 1);
    const short = await loadReviewData(db, { elements: ELEMENTS, days: 7, today: TODAY });
    expect(short[1].history.completed.has(old)).toBe(true);

    const weekStartOfFirstDay = '2023-11-13'; // Monday; today − 1099 is Wednesday 2023-11-15
    insert(ID.tick, weekStartOfFirstDay, 1);
    insert(ID.tick, shiftDateString(weekStartOfFirstDay, -1), 1);
    const long = await loadReviewData(db, { elements: ELEMENTS, days: 1100, today: TODAY });
    expect(long[1].history.completed.has(weekStartOfFirstDay)).toBe(true);
    expect(long[1].history.completed.has(shiftDateString(weekStartOfFirstDay, -1))).toBe(false);
  });
});
