/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- each test loads fresh modules after resetModules() */
import type { HabitConfig } from '../src/protocol';
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * Lock-screen and headset buttons, from the media handler down to SQLite.
 * Only the audio player is faked (there is none in Node); the queue, the
 * stores and the database are the real ones.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../src/audio/habitTimerSound');

type RemoteHandlers = {
  onPlayingChange?: ((playing: boolean) => void) | null;
  onPlaybackProgress?: (() => void) | null;
  onPlaybackEnded?: (() => void) | null;
};

const HABIT_A = '550e8400-e29b-41d4-a716-446655440801';
const HABIT_B = '550e8400-e29b-41d4-a716-446655440802';
const YESTERDAY = '2026-03-09';
const TODAY = '2026-03-10';

let testDb: TestDb;
let handlers: RemoteHandlers;
let tickConfig: HabitConfig;

beforeEach(async () => {
  jest.useFakeTimers({
    now: new Date(2026, 2, 9, 21, 0),
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
  });
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);

  const protocol = require('../src/protocol') as typeof import('../src/protocol');
  const elementRepo = require('../src/db/repositories/elementRepository') as typeof import('../src/db/repositories/elementRepository');
  const dashboardRepo = require('../src/db/repositories/dashboardRepository') as typeof import('../src/db/repositories/dashboardRepository');
  tickConfig = protocol.HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'boolean' });
  for (const [index, id] of [HABIT_A, HABIT_B].entries()) {
    await elementRepo.insertElement(testDb.db, {
      id,
      kind: 'habit',
      name: id === HABIT_A ? 'Kefir' : 'Sprouts',
      config: tickConfig,
      protocolVersion: protocol.PROTOCOL_VERSION,
      createdAt: '2026-01-01T08:00:00.000Z',
      archivedAt: null,
    });
    await dashboardRepo.insertDashboardItem(testDb.db, {
      id: `550e8400-e29b-41d4-a716-44665544081${index}`,
      elementId: id,
      sortOrder: index,
    });
  }

  const sound = require('../src/audio/habitTimerSound') as typeof import('../src/audio/habitTimerSound');
  (sound.setHabitTimerRemoteHandlers as jest.Mock).mockImplementation((next: RemoteHandlers) => {
    handlers = next;
  });
  require('../src/kinds/habit/habitTimerRemote').installHabitTimerRemoteControls();
  await require('../src/hooks/refreshAllDailyData').refreshAllDailyData();
});

afterEach(() => {
  jest.useRealTimers();
  testDb.raw.close();
});

function eventStore() {
  return (require('../src/store/eventStore') as typeof import('../src/store/eventStore')).useEventStore;
}

async function eventsOn(elementId: string, date: string) {
  const eventRepo = require('../src/db/repositories/eventRepository') as typeof import('../src/db/repositories/eventRepository');
  return eventRepo.getEventsForElementOnDate(testDb.db, elementId, date);
}

/** Let the handler's promise chain run to the end. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/** Setup runs on the evening of YESTERDAY; that is "today" until a test moves the clock. */
it('does not un-tick a done habit when play is pressed on it', async () => {
  await eventStore().getState().toggleHabit(HABIT_A, tickConfig);
  await eventStore().getState().toggleHabit(HABIT_B, tickConfig);
  const { setFocusedHabitId } = require('../src/kinds/habit/habitLockScreenQueue') as typeof import('../src/kinds/habit/habitLockScreenQueue');
  setFocusedHabitId(HABIT_A);

  handlers.onPlayingChange?.(true);
  await settle();

  expect(await eventsOn(HABIT_A, YESTERDAY)).toHaveLength(1);
  expect(eventStore().getState().habitDoneToday[HABIT_A]).toBe(true);
});

/**
 * The phone sat locked overnight, so neither the midnight timer nor a
 * foreground refreshed the day. The first press in the morning must act on
 * today: both habits are open, so focus is the first in Home order — not
 * whichever one yesterday's done-map put at the front of the queue.
 */
it('acts on today, not yesterday\'s maps, on the first press after midnight', async () => {
  await eventStore().getState().toggleHabit(HABIT_A, tickConfig);
  jest.setSystemTime(new Date(2026, 2, 10, 7, 0));

  handlers.onPlayingChange?.(true);
  await settle();

  expect(await eventsOn(HABIT_A, TODAY)).toHaveLength(1);
  expect(await eventsOn(HABIT_B, TODAY)).toHaveLength(0);
  expect(await eventsOn(HABIT_A, YESTERDAY)).toHaveLength(1);
  expect(eventStore().getState().habitDoneToday).toEqual({ [HABIT_A]: true, [HABIT_B]: false });
});

/**
 * Playback status keeps arriving while the phone is locked, when JS timers
 * do not run. It is what tells a later restart how long the session really ran,
 * so it stamps the habit the sound is playing for and no other.
 */
it('records a heartbeat for the habit the sound plays for', () => {
  const heartbeat = jest.spyOn(eventStore().getState(), 'recordTimerHeartbeat');
  const { setFocusedHabitId } = require('../src/kinds/habit/habitLockScreenQueue') as typeof import('../src/kinds/habit/habitLockScreenQueue');
  setFocusedHabitId(HABIT_B);

  handlers.onPlaybackProgress?.();

  expect(heartbeat).toHaveBeenCalledWith(HABIT_B);
});

it('drops the heartbeat when the track ends and the session runs on without it', () => {
  const clear = jest.spyOn(eventStore().getState(), 'clearTimerHeartbeats');

  handlers.onPlaybackEnded?.();

  expect(clear).toHaveBeenCalledTimes(1);
});
