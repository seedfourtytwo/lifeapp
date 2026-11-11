/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';
import { seedRealisticTrackers, TRACKERS } from './support/realisticTrackers';
import { timerKit } from './support/timerKit';
import type { ElementDefinition, HabitConfig } from '../src/protocol';

/**
 * The card's timer controls against the fake native core, real stores and
 * real SQLite: what the core is asked to play, and the app's rules on top.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

const NOW = new Date(2026, 2, 10, 9, 30);
const TODAY = '2026-03-10';

let testDb: TestDb;
let trackers: ElementDefinition[];
let timer: ReturnType<typeof timerKit>;
const unhandled = jest.fn();

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  trackers = await seedRealisticTrackers(testDb.db);
  await (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore.getState().load();
  timer = timerKit(trackers);
  unhandled.mockClear();
  process.on('unhandledRejection', unhandled);
});

afterEach(() => {
  process.off('unhandledRejection', unhandled);
  jest.restoreAllMocks();
  jest.useRealTimers();
  testDb.raw.close();
});

function events() {
  return (require('../src/store/eventStore') as typeof import('../src/store/eventStore')).useEventStore.getState();
}

function configOf(id: string): HabitConfig {
  const element = trackers.find((tracker) => tracker.id === id);
  if (element?.kind !== 'habit') throw new Error('not a habit');
  return element.config;
}

async function secondsToday(id: string): Promise<number[]> {
  const eventRepo = require('../src/db/repositories/eventRepository') as typeof import('../src/db/repositories/eventRepository');
  return (await eventRepo.getEventsForElementOnDate(testDb.db, id, TODAY)).map((e) => e.value);
}

describe('the play button', () => {
  it('starts the habit in the core in one tap, with what the notification and lock screen need', async () => {
    const protocol = require('../src/protocol') as typeof import('../src/protocol');
    const meditation = protocol.HabitConfigSchema.parse({
      ...configOf(TRACKERS.meditation),
      timerSound: { trackId: 'meditation15min', playbackMode: 'loop' },
    });
    trackers = trackers.map((t) => (t.id === TRACKERS.meditation ? { ...t, config: meditation } as ElementDefinition : t));
    timer = timerKit(trackers);
    const start = jest.spyOn(timer.core, 'start');

    await timer.press(TRACKERS.meditation);

    expect(start).toHaveBeenCalledWith({
      trackerId: TRACKERS.meditation,
      name: 'Meditation',
      lockScreenName: 'Sit',
      iconKey: 'meditation',
      goal: { type: 'seconds', seconds: 900 },
      trackId: 'meditation15min',
      loop: true,
      loggedSeconds: 0,
    });
    expect(events().activeTimerSessions[TRACKERS.meditation]).toMatchObject({ pausedAt: null });
  });

  it('asks for the silent keepalive when the habit has no track', async () => {
    const start = jest.spyOn(timer.core, 'start');

    await timer.press(TRACKERS.breathing);

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ trackId: null, lockScreenName: null }));
  });

  it('pauses on the second tap and resumes on the third', async () => {
    await timer.press(TRACKERS.breathing);
    jest.setSystemTime(new Date(2026, 2, 10, 9, 31));
    await timer.press(TRACKERS.breathing);
    expect(events().activeTimerSessions[TRACKERS.breathing]?.pausedAt).toBe(
      new Date(2026, 2, 10, 9, 31).toISOString(),
    );

    jest.setSystemTime(new Date(2026, 2, 10, 9, 33));
    await timer.press(TRACKERS.breathing);

    expect(events().activeTimerSessions[TRACKERS.breathing]).toMatchObject({
      pausedAt: null,
      pauseOffsetMs: 120_000,
    });
  });

  it('tells the goal alarm what today already logged', async () => {
    const eventRepo = require('../src/db/repositories/eventRepository') as typeof import('../src/db/repositories/eventRepository');
    const protocol = require('../src/protocol') as typeof import('../src/protocol');
    await eventRepo.insertEvent(testDb.db, {
      id: '550e8400-e29b-41d4-a716-446655449001',
      elementId: TRACKERS.breathing,
      timestamp: new Date(2026, 2, 10, 7, 0).toISOString(),
      date: TODAY,
      value: 120,
      meta: { source: 'timer_session', startedAt: new Date(2026, 2, 10, 6, 58).toISOString(), endedAt: new Date(2026, 2, 10, 7, 0).toISOString(), durationSeconds: 120 },
      protocolVersion: protocol.PROTOCOL_VERSION,
    });
    await events().loadHabitDayState([{ id: TRACKERS.breathing, config: configOf(TRACKERS.breathing) }]);
    const start = jest.spyOn(timer.core, 'start');

    await timer.press(TRACKERS.breathing);

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ loggedSeconds: 120 }));
  });

  it('says so when the core cannot start, and leaves nothing unhandled', async () => {
    const { Alert } = require('react-native') as typeof import('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(timer.core, 'start').mockRejectedValueOnce(new Error('audio focus denied'));

    await timer.press(TRACKERS.breathing);
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));

    expect(alert).toHaveBeenCalledWith(expect.any(String), 'audio focus denied');
    expect(unhandled).not.toHaveBeenCalled();
    expect(events().activeTimerSessions).toEqual({});
  });
});

describe('resetting today', () => {
  it('banks a running session first, and Undo puts the day back', async () => {
    await timer.press(TRACKERS.breathing);
    jest.setSystemTime(new Date(2026, 2, 10, 9, 32));

    const undo = await timer.controls.resetHabitTimerToday(TRACKERS.breathing, configOf(TRACKERS.breathing));

    expect(await secondsToday(TRACKERS.breathing)).toEqual([]);
    await expect(timer.core.getState()).resolves.toBeNull();
    await undo();
    expect(await secondsToday(TRACKERS.breathing)).toEqual([120]);
  });
});

describe('a habit leaving Home', () => {
  it('takes its running session with it and logs nothing', async () => {
    await timer.press(TRACKERS.breathing);
    jest.setSystemTime(new Date(2026, 2, 10, 9, 35));

    await (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore
      .getState()
      .archiveElement(TRACKERS.breathing);

    await expect(timer.core.getState()).resolves.toBeNull();
    expect(events().activeTimerSessions).toEqual({});
    expect(await secondsToday(TRACKERS.breathing)).toEqual([]);
  });

  it('leaves another habit\'s session alone', async () => {
    await timer.press(TRACKERS.meditation);

    await (require('../src/store/elementStore') as typeof import('../src/store/elementStore')).useElementStore
      .getState()
      .archiveElement(TRACKERS.breathing);

    await expect(timer.core.getState()).resolves.toMatchObject({ trackerId: TRACKERS.meditation });
  });
});
