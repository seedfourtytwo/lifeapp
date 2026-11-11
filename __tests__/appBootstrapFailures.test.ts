/* eslint-disable import/first -- jest mocks must load before module imports */
/**
 * Start-up fires several loads without awaiting them. When one fails — here
 * the events table cannot be read — the app must log it and carry on, not
 * leave an unhandled rejection behind.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../src/audio/habitTimerSound');
jest.mock('../src/audio/habitCompleteSound');

import { getDatabase } from '../src/db/client';
import * as dashboardRepo from '../src/db/repositories/dashboardRepository';
import * as elementRepo from '../src/db/repositories/elementRepository';
import { useAppBootstrap } from '../src/hooks/useAppBootstrap';
import { warmupHabitSoundPlayback } from '../src/audio/habitTimerSound';
import { warmupHabitCompleteChime } from '../src/audio/habitCompleteSound';
import { HabitConfigSchema, PROTOCOL_VERSION } from '../src/protocol';

const HABIT = '550e8400-e29b-41d4-a716-446655440951';

let testDb: TestDb;
let tree: ReactTestRenderer;
const unhandled = jest.fn();

function Host(): null {
  useAppBootstrap();
  return null;
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  });
}

beforeEach(async () => {
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
  await dashboardRepo.insertDashboardItem(testDb.db, {
    id: '550e8400-e29b-41d4-a716-446655440952',
    elementId: HABIT,
    sortOrder: 0,
  });
  testDb.raw.exec('PRAGMA foreign_keys = OFF; DROP TABLE events;');
  (warmupHabitSoundPlayback as jest.Mock).mockRejectedValue(new Error('no audio session'));
  (warmupHabitCompleteChime as jest.Mock).mockRejectedValue(new Error('no audio session'));
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  unhandled.mockClear();
  process.on('unhandledRejection', unhandled);
});

afterEach(() => {
  act(() => tree.unmount());
  process.off('unhandledRejection', unhandled);
  jest.restoreAllMocks();
  testDb.raw.close();
});

it('logs failed start-up loads instead of leaving them unhandled', async () => {
  await act(async () => {
    tree = TestRenderer.create(React.createElement(Host));
  });
  await flush();

  expect(unhandled).not.toHaveBeenCalled();
});
