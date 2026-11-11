/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- modules load after their native fakes are in place */
import type { AppStateStatus } from 'react-native';

/**
 * Opening the app re-plays the timer audio if the OS interrupted it. After a
 * timer has finished there is nothing to resume — but the player object is
 * kept, so playing it again told the lock-screen handlers "playing", and
 * they started a timer or flipped a tick on whatever habit had focus.
 */

type StatusListener = (status: Record<string, unknown>) => void;

class FakePlayer {
  playing = false;
  loop = false;
  muted = false;
  currentTime = 0;
  private listener: StatusListener | null = null;
  play = jest.fn(() => {
    this.playing = true;
    // The OS reports the new state back asynchronously, as expo-audio does.
    queueMicrotask(() =>
      this.listener?.({ isLoaded: true, playing: true, currentTime: 0, duration: 2, loop: this.loop }),
    );
  });
  pause = jest.fn(() => {
    this.playing = false;
  });
  replace = jest.fn();
  seekTo = jest.fn(async () => undefined);
  setActiveForLockScreen = jest.fn();
  clearLockScreenControls = jest.fn();
  updateLockScreenMetadata = jest.fn();
  remove = jest.fn();
  addListener(_event: string, listener: StatusListener) {
    this.listener = listener;
    return { remove: () => (this.listener = null) };
  }
}

const mockPlayer = new FakePlayer();

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => mockPlayer,
  setAudioModeAsync: async () => undefined,
}));

let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const { AppState } = require('react-native');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((...args: unknown[]) => {
    appStateListener = args[1] as (state: AppStateStatus) => void;
    return { remove: () => undefined };
  });
});

afterEach(() => {
  jest.useRealTimers();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  jest.advanceTimersByTime(300);
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

it('does not restart audio on foreground after the timer stopped', async () => {
  const sound = require('../src/audio/habitTimerSound.native') as typeof import('../src/audio/habitTimerSound.native');
  const onPlayingChange = jest.fn();
  sound.setHabitTimerRemoteHandlers({ onPlayingChange });

  await sound.playHabitSound();
  await settle();
  await sound.stopHabitSound();
  await settle();
  mockPlayer.play.mockClear();
  onPlayingChange.mockClear();

  appStateListener?.('active');
  await settle();

  expect(mockPlayer.play).not.toHaveBeenCalled();
  expect(onPlayingChange).not.toHaveBeenCalledWith(true);
});
