/* eslint-disable import/first -- jest mocks must load before module imports */
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../src/db/client';
import { exportProtocolBundle, serializeBundle } from '../src/db/export';
import * as elementRepo from '../src/db/repositories/elementRepository';
import * as eventRepo from '../src/db/repositories/eventRepository';
import { HabitConfigSchema, parseProtocolBundle, PROTOCOL_VERSION } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * The repositories skip a row they cannot read rather than fail the whole
 * list. For a screen that is right; for a backup it means the file is
 * silently short. The export has to say how many rows it left out.
 */

const HABIT_ID = '550e8400-e29b-41d4-a716-446655440501';

let testDb: TestDb;

beforeEach(async () => {
  testDb = await createMigratedTestDb();
  (getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await elementRepo.insertElement(testDb.db, {
    id: HABIT_ID,
    kind: 'habit',
    name: 'Meditate',
    config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  });
  await eventRepo.insertEvent(testDb.db, {
    id: '550e8400-e29b-41d4-a716-446655440502',
    elementId: HABIT_ID,
    timestamp: '2026-01-02T08:00:00.000Z',
    date: '2026-01-02',
    value: 1,
    meta: { source: 'habit_tick' },
    protocolVersion: PROTOCOL_VERSION,
  });
});

afterEach(() => {
  testDb.raw.close();
});

it('reports nothing skipped when every row reads back', async () => {
  const { bundle, skippedRows } = await exportProtocolBundle();

  expect(bundle.events).toHaveLength(1);
  expect(skippedRows).toBe(0);
});

it('counts the rows it could not read instead of looking complete', async () => {
  testDb.raw
    .prepare(
      `INSERT INTO events (id, element_id, timestamp, date, value, meta_json, protocol_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run('not-a-uuid', HABIT_ID, 'yesterday', '2026-01-03', 1, null, PROTOCOL_VERSION);
  testDb.raw
    .prepare(
      `INSERT INTO todos (id, title, note, due_date, sort_order, created_at, completed_at, protocol_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run('550e8400-e29b-41d4-a716-446655440503', '', null, null, 0, 'never', null, PROTOCOL_VERSION);

  const { bundle, skippedRows } = await exportProtocolBundle();

  expect(bundle.events).toHaveLength(1);
  expect(skippedRows).toBe(2);
});

it('leaves out a Home row it could not read, so the file still imports', async () => {
  testDb.raw
    .prepare('INSERT INTO dashboard_items (id, element_id, sort_order) VALUES (?, ?, ?)')
    .run('not-a-uuid', HABIT_ID, 0);

  const { bundle, skippedRows } = await exportProtocolBundle();

  expect(bundle.dashboard).toEqual([]);
  expect(skippedRows).toBe(1);
  expect(() => parseProtocolBundle(JSON.parse(serializeBundle(bundle)))).not.toThrow();
});
