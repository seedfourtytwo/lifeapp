/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- modules load after the audio fake is configured */
import { createMigratedTestDb, type TestDb } from './support/sqliteTestDb';

/**
 * Timer audio is a side effect: if the player fails to start, the timer
 * still runs and its seconds still count. The failure must be handled, not
 * left as an unhandled rejection that the release build may treat as a crash.
 */

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../src/audio/habitTimerSound');

const HABIT = '550e8400-e29b-41d4-a716-446655440901';

let testDb: TestDb;
const unhandled = jest.fn();

beforeEach(async () => {
  jest.resetModules();
  testDb = await createMigratedTestDb();
  (require('../src/db/client').getDatabase as jest.Mock).mockResolvedValue(testDb.db);
  const sound = require('../src/audio/habitTimerSound') as typeof import('../src/audio/habitTimerSound');
  (sound.playHabitSound as jest.Mock).mockRejectedValue(new Error('audio focus denied'));
  (sound.resumeHabitSound as jest.Mock).mockRejectedValue(new Error('audio focus denied'));
  (sound.stopHabitSound as jest.Mock).mockResolvedValue(undefined);
  (sound.pauseHabitSound as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  unhandled.mockClear();
  process.on('unhandledRejection', unhandled);
});

afterEach(() => {
  process.off('unhandledRejection', unhandled);
  jest.restoreAllMocks();
  testDb.raw.close();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function config(timerSound?: { trackId: string; playbackMode: 'loop' }) {
  const { HabitConfigSchema } = require('../src/protocol') as typeof import('../src/protocol');
  return HabitConfigSchema.parse({ timeSlot: 'anytime', trackingMode: 'timer', timerSound });
}

it('keeps the timer running when its sound fails to start', async () => {
  const controls = require('../src/habitTimer/habitTimerControls') as typeof import('../src/habitTimer/habitTimerControls');
  const { useEventStore } = require('../src/store/eventStore') as typeof import('../src/store/eventStore');

  controls.startHabitTimerSession(HABIT, config());
  await settle();

  expect(useEventStore.getState().activeTimerSessions[HABIT]).toBeDefined();
  expect(unhandled).not.toHaveBeenCalled();
});

it('handles a sound that fails on resume', async () => {
  const controls = require('../src/habitTimer/habitTimerControls') as typeof import('../src/habitTimer/habitTimerControls');
  const { useEventStore } = require('../src/store/eventStore') as typeof import('../src/store/eventStore');
  useEventStore.getState().startHabitTimer(HABIT, config());
  useEventStore.getState().pauseHabitTimer(HABIT);

  controls.resumeHabitTimerSession(HABIT, config());
  await settle();
  useEventStore.getState().pauseHabitTimer(HABIT);
  controls.resumeHabitTimerSession(HABIT, config({ trackId: 'meditation15min', playbackMode: 'loop' }));
  await settle();

  expect(unhandled).not.toHaveBeenCalled();
});
