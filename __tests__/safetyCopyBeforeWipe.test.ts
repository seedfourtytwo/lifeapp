/* eslint-disable import/first -- jest mocks must load before module imports */
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../src/db/safetyCopy', () => ({
  takeSafetyCopy: jest.fn(),
}));

import { getDatabase } from '../src/db/client';
import { takeSafetyCopy } from '../src/db/safetyCopy';
import { exportProtocolBundle, importProtocolBundle } from '../src/db/export';
import { clearAllAppData } from '../src/db/resetAppData';
import * as elementRepo from '../src/db/repositories/elementRepository';
import { HabitConfigSchema, PROTOCOL_VERSION } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/** A wipe never runs without a raw copy of what it is about to replace. */

const HABIT = '550e8400-e29b-41d4-a716-446655440701';

let testDb: TestDb;

function elementCount(): number {
  return Number((testDb.raw.prepare('SELECT COUNT(*) AS n FROM elements').get() as { n: number }).n);
}

beforeEach(async () => {
  jest.clearAllMocks();
  testDb = await createMigratedTestDb();
  (getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await elementRepo.insertElement(testDb.db, {
    id: HABIT,
    kind: 'habit',
    name: 'Stretch',
    config: HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' }),
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  });
});

it.each([
  ['import', () => exportProtocolBundle().then(({ bundle }) => importProtocolBundle({ ...bundle, elements: [] }))],
  ['clear', () => clearAllAppData()],
] as const)('copies the database before the %s wipes it', async (reason, wipe) => {
  const countsAtCopy: number[] = [];
  (takeSafetyCopy as jest.Mock).mockImplementation(async () => {
    countsAtCopy.push(elementCount());
  });

  await wipe();

  expect(takeSafetyCopy).toHaveBeenCalledWith(testDb.db, reason);
  expect(countsAtCopy).toEqual([1]);
  expect(elementCount()).toBe(0);
});

it.each([
  ['import', () => exportProtocolBundle().then(({ bundle }) => importProtocolBundle({ ...bundle, elements: [] }))],
  ['clear', () => clearAllAppData()],
] as const)('leaves everything in place when the copy before the %s fails', async (_reason, wipe) => {
  (takeSafetyCopy as jest.Mock).mockRejectedValue(new Error('disk full'));

  await expect(wipe()).rejects.toThrow('disk full');

  expect(elementCount()).toBe(1);
});
