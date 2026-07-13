import { getBundledHabitSoundModule } from '../src/audio/bundledHabitSoundAssets.native';
import {
  buildHabitTimerSound,
  formatHabitTimerSoundSummary,
  getHabitTimerPlaybackMode,
  hasHabitTimerSound,
} from '../src/protocol/habitSound';
import { BUNDLED_HABIT_SOUND_CATALOG } from '../src/protocol/habitSoundCatalog';

describe('buildHabitTimerSound', () => {
  it('builds bundled track sounds', () => {
    const sound = buildHabitTimerSound({
      trackId: 'meditation15min',
      playbackMode: 'play_once',
    });

    expect(sound).toEqual({
      trackId: 'meditation15min',
      playbackMode: 'play_once',
    });
  });

  it('rejects unknown track ids', () => {
    expect(buildHabitTimerSound({ trackId: 'missing-track' })).toBeUndefined();
  });

  it('returns undefined when empty', () => {
    expect(buildHabitTimerSound({})).toBeUndefined();
  });
});

describe('getHabitTimerPlaybackMode', () => {
  it('defaults to loop when playback mode is missing', () => {
    expect(
      getHabitTimerPlaybackMode(buildHabitTimerSound({ trackId: 'meditation15min' })),
    ).toBe('loop');
    expect(
      getHabitTimerPlaybackMode({
        trackId: 'meditation15min',
        playbackMode: 'play_once',
      }),
    ).toBe('play_once');
  });
});

describe('formatHabitTimerSoundSummary', () => {
  it('describes bundled sound and playback mode', () => {
    expect(
      formatHabitTimerSoundSummary({
        trackId: 'meditation15min',
      }),
    ).toBe('Meditation 15 min · Loops');
  });

  it('describes play-once mode', () => {
    expect(
      formatHabitTimerSoundSummary({
        trackId: 'meditation30min',
        playbackMode: 'play_once',
      }),
    ).toBe('Meditation 30 min · Track length');
  });

  it('returns null when no sound configured', () => {
    expect(hasHabitTimerSound(undefined)).toBe(false);
    expect(formatHabitTimerSoundSummary(undefined)).toBeNull();
  });
});

describe('bundled catalog and native assets stay in sync', () => {
  it('maps every catalog id to a native asset', () => {
    for (const track of BUNDLED_HABIT_SOUND_CATALOG) {
      expect(getBundledHabitSoundModule(track.id)).toBeDefined();
    }
  });
});
