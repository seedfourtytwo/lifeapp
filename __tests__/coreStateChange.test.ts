/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import * as fs from 'node:fs';
import type { ReactTestRenderer } from 'react-test-renderer';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { createFakeFileSystem, type FakeFileSystem } from './support/fakeFileSystem';
import { seedRealisticTrackers, TRACKERS } from './support/realisticTrackers';

/**
 * A transition the app did not make (the notification's Pause or Done, a
 * track that ended) reaches the app as a state change: the mirror follows,
 * then the queue is drained and the stores refreshed from SQLite.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
let mockFs: FakeFileSystem;
jest.mock('expo-file-system/legacy', () => mockFs.module);

const NOW = new Date(2026, 2, 10, 9, 30);

let testDb: TestDb;
let tree: ReactTestRenderer;
/** Loaded after resetModules, so the hooks and the renderer share one React. */
let act: typeof import('react-test-renderer').act;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  mockFs = createFakeFileSystem();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  await seedRealisticTrackers(testDb.db);
  fs.mkdirSync(`${mockFs.root}/widget`, { recursive: true });
  const React = require('react') as typeof import('react');
  const TestRenderer = require('react-test-renderer') as typeof import('react-test-renderer');
  act = TestRenderer.act;
  const { useAppBootstrap } = require('../src/hooks/useAppBootstrap') as typeof import('../src/hooks/useAppBootstrap');
  function Host(): null {
    useAppBootstrap();
    return null;
  }
  await act(async () => {
    tree = TestRenderer.create(React.createElement(Host));
  });
  await settle();
});

afterEach(() => {
  act(() => tree.unmount());
  jest.useRealTimers();
  testDb.raw.close();
  mockFs.cleanup();
});

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve));
  });
}

function core() {
  return (require('../src/core/lifeCore') as typeof import('../src/core/lifeCore')).lifeCore;
}

function events() {
  return (require('../src/store/eventStore') as typeof import('../src/store/eventStore')).useEventStore.getState();
}

it('mirrors a session the core started and paused by itself', async () => {
  await core().start({
    trackerId: TRACKERS.breathing,
    name: 'Breathing',
    lockScreenName: null,
    iconKey: 'lungs',
    goal: { type: 'seconds', seconds: 300 },
    trackId: null,
    loop: true,
    loggedSeconds: 0,
  });
  await settle();
  expect(events().activeTimerSessions[TRACKERS.breathing]).toMatchObject({ pausedAt: null });

  await core().pause();
  await settle();

  expect(events().activeTimerSessions[TRACKERS.breathing]?.pausedAt).toBe(NOW.toISOString());
});

it('drains the queue and refreshes on a state change', async () => {
  fs.appendFileSync(
    `${mockFs.root}/widget/pending-actions.jsonl`,
    `${JSON.stringify({
      v: 1,
      id: '550e8400-e29b-41d4-a716-446655449101',
      at: NOW.toISOString(),
      day: '2026-03-10',
      type: 'habit_complete',
      trackerId: TRACKERS.creatine,
    })}\n`,
  );

  await core().start({
    trackerId: TRACKERS.breathing,
    name: 'Breathing',
    lockScreenName: null,
    iconKey: null,
    goal: { type: 'open' },
    trackId: null,
    loop: true,
    loggedSeconds: 0,
  });
  await settle();

  expect(events().habitDoneToday[TRACKERS.creatine]).toBe(true);
  expect(fs.existsSync(`${mockFs.root}/widget/pending-actions.jsonl`)).toBe(false);
});
