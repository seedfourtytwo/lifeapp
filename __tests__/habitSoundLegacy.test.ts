import { buildLegacyHabitTimerSoundFromLibrary } from '../src/db/migrations/habitSoundLegacy';

describe('buildLegacyHabitTimerSoundFromLibrary', () => {
  it('converts youtube library entries', () => {
    expect(
      buildLegacyHabitTimerSoundFromLibrary({
        source: 'youtube',
        uri: 'https://youtu.be/dQw4w9WgXcQ',
        label: 'Rick',
      }),
    ).toEqual({
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      localLabel: 'Rick',
    });
  });

  it('converts local file library entries', () => {
    expect(
      buildLegacyHabitTimerSoundFromLibrary({
        source: 'file',
        uri: 'file:///data/habit-sounds/meditation.mp3',
        label: 'Meditation',
      }),
    ).toEqual({
      localUri: 'file:///data/habit-sounds/meditation.mp3',
      localLabel: 'Meditation',
    });
  });

  it('rejects invalid youtube urls', () => {
    expect(
      buildLegacyHabitTimerSoundFromLibrary({
        source: 'youtube',
        uri: 'not-a-url',
      }),
    ).toBeUndefined();
  });
});
