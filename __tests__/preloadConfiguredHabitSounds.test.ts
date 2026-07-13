import type { ElementDefinition } from '../src/protocol';
import { preloadConfiguredHabitSounds } from '../src/audio/preloadConfiguredHabitSounds';
import { preloadHabitSound } from '../src/audio/habitTimerSound';

jest.mock('../src/audio/habitTimerSound', () => ({
  warmupHabitSoundPlayback: jest.fn(async () => undefined),
  preloadHabitSound: jest.fn(async () => true),
  isHabitSoundCached: jest.fn(() => false),
}));

const preload = preloadHabitSound as jest.Mock;

describe('preloadConfiguredHabitSounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preloads each configured track once', async () => {
    const elements: ElementDefinition[] = [
      {
        id: '1',
        kind: 'habit',
        name: 'Meditate',
        protocolVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        config: {
          timeSlot: 'morning',
          trackingMode: 'timer',
          timerSound: { trackId: 'meditation15min' },
        },
      },
      {
        id: '2',
        kind: 'habit',
        name: 'Meditate again',
        protocolVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        config: {
          timeSlot: 'evening',
          trackingMode: 'timer',
          timerSound: { trackId: 'meditation15min' },
        },
      },
      {
        id: '3',
        kind: 'habit',
        name: 'Wim Hof',
        protocolVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        config: {
          timeSlot: 'morning',
          trackingMode: 'timer',
          timerSound: { trackId: 'wimhofMorning' },
        },
      },
    ];

    await preloadConfiguredHabitSounds(elements);

    expect(preload).toHaveBeenCalledTimes(2);
    expect(preload).toHaveBeenCalledWith({ trackId: 'meditation15min' });
    expect(preload).toHaveBeenCalledWith({ trackId: 'wimhofMorning' });
  });

  it('skips habits without bundled sounds', async () => {
    const elements: ElementDefinition[] = [
      {
        id: '1',
        kind: 'habit',
        name: 'Stretch',
        protocolVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        config: {
          timeSlot: 'morning',
          trackingMode: 'timer',
        },
      },
      {
        id: '2',
        kind: 'counter',
        name: 'Pushups',
        protocolVersion: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        config: {
          quickIncrements: [5],
        },
      },
    ];

    await preloadConfiguredHabitSounds(elements);

    expect(preload).not.toHaveBeenCalled();
  });
});
