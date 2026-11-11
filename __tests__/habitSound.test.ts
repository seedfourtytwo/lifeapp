import {
  buildHabitTimerSound,
  formatHabitTimerSoundSummary,
  getHabitTimerPlaybackMode,
  habitTimerTrack,
  hasHabitTimerSound,
} from '../src/protocol/habitSound';

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

describe('habitTimerTrack', () => {
  it('names the bundled track and whether it loops', () => {
    expect(habitTimerTrack({ trackId: ' meditation15min ' })).toEqual({ trackId: 'meditation15min', loop: true });
    expect(habitTimerTrack({ trackId: 'wimhofMorning', playbackMode: 'play_once' })).toEqual({
      trackId: 'wimhofMorning',
      loop: false,
    });
  });

  it('plays nothing for no sound or a track that is not bundled', () => {
    expect(habitTimerTrack(undefined)).toEqual({ trackId: null, loop: true });
    expect(habitTimerTrack({ trackId: 'missing-track' })).toEqual({ trackId: null, loop: true });
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
