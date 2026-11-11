import * as elementRepo from '../src/db/repositories/elementRepository';
import { PROTOCOL_VERSION } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

const HABIT = '550e8400-e29b-41d4-a716-446655440a01';
const COUNTER = '550e8400-e29b-41d4-a716-446655440a02';
const BROKEN = '550e8400-e29b-41d4-a716-446655440a03';

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createMigratedTestDb();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  testDb.raw.close();
});

function storeRaw(id: string, kind: string, config: unknown): void {
  testDb.raw
    .prepare(
      `INSERT INTO elements (id, kind, name, config_json, protocol_version, created_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(id, kind, 'Tracker', JSON.stringify(config), PROTOCOL_VERSION, '2026-01-01T08:00:00.000Z');
}

describe('reading elements', () => {
  it('hands back each config parsed for its kind, with the defaults filled in', async () => {
    storeRaw(HABIT, 'habit', { timeSlot: 'morning' });
    storeRaw(COUNTER, 'counter', { unit: 'glasses', quickIncrements: [1] });

    const [habit, counter] = await elementRepo.getAllElements(testDb.db);

    expect(habit?.kind).toBe('habit');
    expect(habit?.config).toEqual({
      timeSlot: 'morning',
      trackingMode: 'boolean',
      schedule: { type: 'daily' },
      reminderTimes: [],
    });
    expect(counter).toMatchObject({ kind: 'counter', config: { unit: 'glasses', quickIncrements: [1] } });
  });

  it('skips a row whose config does not fit its kind, and keeps the rest', async () => {
    storeRaw(HABIT, 'habit', { timeSlot: 'anytime' });
    storeRaw(BROKEN, 'counter', { unit: 'glasses', quickIncrements: [] });

    const elements = await elementRepo.getAllElements(testDb.db);

    expect(elements.map((e) => e.id)).toEqual([HABIT]);
    expect(await elementRepo.getElementById(testDb.db, BROKEN)).toBeNull();
  });
});
