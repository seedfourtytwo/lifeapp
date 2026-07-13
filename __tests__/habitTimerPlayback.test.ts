/* eslint-disable import/first -- jest mocks must load before module imports */
import type { HabitTimerSound } from '../src/protocol/habitSound';

jest.mock('../src/audio/bundledHabitSoundAssets', () => ({
  getBundledHabitSoundModule: jest.fn(),
}));

import { getBundledHabitSoundModule } from '../src/audio/bundledHabitSoundAssets';
import { resolveHabitTimerPlaybackSource } from '../src/audio/habitTimerPlayback';

const getModule = getBundledHabitSoundModule as jest.Mock;

describe('resolveHabitTimerPlaybackSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves bundled tracks by id', async () => {
    getModule.mockReturnValue(42);

    const sound: HabitTimerSound = {
      trackId: 'meditation15min',
    };

    await expect(resolveHabitTimerPlaybackSource(sound)).resolves.toEqual({
      type: 'bundled',
      moduleId: 42,
    });
  });

  it('returns null for unknown track ids', async () => {
    getModule.mockReturnValue(undefined);

    const sound: HabitTimerSound = {
      trackId: 'missing-track',
    };

    await expect(resolveHabitTimerPlaybackSource(sound)).resolves.toBeNull();
  });

  it('returns null when track id is missing', async () => {
    const sound: HabitTimerSound = {};

    await expect(resolveHabitTimerPlaybackSource(sound)).resolves.toBeNull();
  });
});
