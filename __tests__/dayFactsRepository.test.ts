import { DatabaseSync } from 'node:sqlite';
import {
  dayFactsFromEvents,
  HabitConfigSchema,
  PROTOCOL_VERSION,
  type DayFacts,
  type LifeEvent,
} from '../src/protocol';
import * as elementRepo from '../src/db/repositories/elementRepository';
import * as eventRepo from '../src/db/repositories/eventRepository';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

const HABIT = '550e8400-e29b-41d4-a716-446655440701';
const OTHER = '550e8400-e29b-41d4-a716-446655440702';
const EMPTY: DayFacts = { total: 0, trackCompleted: false, markedComplete: false };

let testDb: TestDb;
let seq = 0;

function event(
  elementId: string,
  date: string,
  value: number,
  meta?: Record<string, unknown>,
): LifeEvent {
  seq += 1;
  return {
    id: `550e8400-e29b-41d4-a716-${String(446655440000 + seq).padStart(12, '0')}`,
    elementId,
    timestamp: `${date}T08:${String(seq % 60).padStart(2, '0')}:00.000Z`,
    date,
    value,
    meta,
    protocolVersion: PROTOCOL_VERSION,
  };
}

const session = (seconds: number, trackCompleted?: boolean) => ({
  source: 'timer_session',
  startedAt: '2026-03-10T08:00:00.000Z',
  endedAt: '2026-03-10T08:15:00.000Z',
  durationSeconds: seconds,
  ...(trackCompleted === undefined ? {} : { trackCompleted }),
});

beforeEach(async () => {
  testDb = await createMigratedTestDb();
  for (const id of [HABIT, OTHER]) {
    await elementRepo.insertElement(testDb.db, {
      id,
      kind: 'habit',
      name: 'Meditate',
      config: HabitConfigSchema.parse({ trackingMode: 'timer' }),
      protocolVersion: PROTOCOL_VERSION,
      createdAt: '2026-01-01T08:00:00.000Z',
      archivedAt: null,
    });
  }
});

afterEach(() => {
  testDb.raw.close();
});

async function seed(events: LifeEvent[]): Promise<void> {
  for (const e of events) await eventRepo.insertEvent(testDb.db, e);
}

describe('SQLite JSON support', () => {
  it('node:sqlite runs json_extract and json_valid, reading JSON true as 1', () => {
    const raw = new DatabaseSync(':memory:');
    const row = raw
      .prepare(
        `SELECT json_extract('{"source":"timer_session","trackCompleted":true}', '$.trackCompleted') AS flag,
                json_extract('{"source":"manual_complete"}', '$.source') AS source,
                json_valid('{not json') AS valid`,
      )
      .get() as { flag: number; source: string; valid: number };
    raw.close();
    expect(row).toEqual({ flag: 1, source: 'manual_complete', valid: 0 });
  });
});

describe('getDayFactsForElementsOnDate', () => {
  it('gives the same facts as reading the events one by one', async () => {
    const events = [
      event(HABIT, '2026-03-10', 300, session(300)),
      event(HABIT, '2026-03-10', 615, session(615, true)),
      event(HABIT, '2026-03-10', 0, { source: 'manual_complete' }),
      event(HABIT, '2026-03-09', 900, session(900, true)),
      event(OTHER, '2026-03-10', 120, session(120, false)),
    ];
    await seed(events);

    const facts = await eventRepo.getDayFactsForElementsOnDate(testDb.db, [HABIT, OTHER], '2026-03-10');

    expect(facts.get(HABIT)).toEqual(
      dayFactsFromEvents(events.filter((e) => e.elementId === HABIT && e.date === '2026-03-10')),
    );
    expect(facts.get(HABIT)).toEqual({ total: 915, trackCompleted: true, markedComplete: true });
    expect(facts.get(OTHER)).toEqual({ total: 120, trackCompleted: false, markedComplete: false });
  });

  it('gives an empty day for an element with nothing logged', async () => {
    const facts = await eventRepo.getDayFactsForElementsOnDate(testDb.db, [HABIT], '2026-03-10');
    expect(facts.get(HABIT)).toEqual(EMPTY);
  });

  it('counts a finished track only on a timer session, like the rule does', async () => {
    await seed([event(HABIT, '2026-03-10', 1, { source: 'habit_tick', trackCompleted: true })]);
    const facts = await eventRepo.getDayFactsForElementsOnDate(testDb.db, [HABIT], '2026-03-10');
    expect(facts.get(HABIT)).toEqual({ ...EMPTY, total: 1 });
  });

  it('reads rows with no meta and does not fail on a row whose meta is not JSON', async () => {
    await seed([event(HABIT, '2026-03-10', 1)]);
    testDb.raw
      .prepare(
        `INSERT INTO events (id, element_id, timestamp, date, value, meta_json, protocol_version)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        '550e8400-e29b-41d4-a716-446655449999',
        HABIT,
        '2026-03-10T09:00:00.000Z',
        '2026-03-10',
        2,
        '{broken',
        PROTOCOL_VERSION,
      );

    const facts = await eventRepo.getDayFactsForElementsOnDate(testDb.db, [HABIT], '2026-03-10');

    expect(facts.get(HABIT)).toEqual({ ...EMPTY, total: 3 });
  });
});

describe('the recorded goal', () => {
  it('comes from the latest session of the day that recorded one, as in the rule', async () => {
    const events = [
      { ...event(HABIT, '2026-03-10', 300, { ...session(300), goalSeconds: 900 }), timestamp: '2026-03-10T07:00:00.000Z' },
      { ...event(HABIT, '2026-03-10', 200, { ...session(200), goalSeconds: 600 }), timestamp: '2026-03-10T09:00:00.000Z' },
      { ...event(HABIT, '2026-03-10', 60, session(60)), timestamp: '2026-03-10T10:00:00.000Z' },
      { ...event(HABIT, '2026-03-09', 60, { ...session(60), goalSeconds: 300 }), timestamp: '2026-03-09T23:00:00.000Z' },
    ];
    await seed(events);

    const onDate = await eventRepo.getDayFactsForElementsOnDate(testDb.db, [HABIT], '2026-03-10');
    const since = await eventRepo.getDayFactsForElementsSince(testDb.db, [HABIT], '2026-03-09');

    expect(onDate.get(HABIT)).toEqual({ ...EMPTY, total: 560, goalSeconds: 600 });
    expect(onDate.get(HABIT)).toEqual(dayFactsFromEvents(events.slice(0, 3)));
    expect(since.get(HABIT)?.map((d) => d.facts.goalSeconds)).toEqual([300, 600]);
  });

  it('is left out on a day no session recorded one', async () => {
    await seed([event(HABIT, '2026-03-10', 60, session(60))]);
    const onDate = await eventRepo.getDayFactsForElementsOnDate(testDb.db, [HABIT], '2026-03-10');
    expect(onDate.get(HABIT)).not.toHaveProperty('goalSeconds');
  });
});

describe('getDayFactsForElementsSince', () => {
  it('gives one entry per logged day from the since-date on, oldest first', async () => {
    await seed([
      event(HABIT, '2026-03-07', 600, session(600)),
      event(HABIT, '2026-03-08', 100, session(100, true)),
      event(HABIT, '2026-03-10', 0, { source: 'manual_complete' }),
      event(HABIT, '2026-03-10', 40, session(40)),
      event(OTHER, '2026-03-09', 5, session(5)),
    ]);

    const byElement = await eventRepo.getDayFactsForElementsSince(
      testDb.db,
      [HABIT, OTHER],
      '2026-03-08',
    );

    expect(byElement.get(HABIT)).toEqual([
      { date: '2026-03-08', facts: { total: 100, trackCompleted: true, markedComplete: false } },
      { date: '2026-03-10', facts: { total: 40, trackCompleted: false, markedComplete: true } },
    ]);
    expect(byElement.get(OTHER)).toEqual([
      { date: '2026-03-09', facts: { total: 5, trackCompleted: false, markedComplete: false } },
    ]);
  });

  it('seeds every requested element, even one with no days', async () => {
    const byElement = await eventRepo.getDayFactsForElementsSince(testDb.db, [HABIT], '2026-03-01');
    expect(byElement.get(HABIT)).toEqual([]);
  });
});
