import type { ElementEditorSaveData } from '../src/components/elementEditor/types';
import { parseElementEditorSave } from '../src/utils/parseElementEditorSave';

const habitSaveData = (
  overrides: Partial<Extract<ElementEditorSaveData, { mode: 'habit' }>> = {},
): Extract<ElementEditorSaveData, { mode: 'habit' }> => ({
  mode: 'habit',
  name: 'Meditation',
  targetLabel: '',
  habitTrackingMode: 'boolean',
  habitDailyGoalMinutes: '',
  habitSoundTrackId: '',
  habitSoundPlaybackMode: 'play_once' as const,
  timeSlot: 'morning',
  useTimeRange: false,
  timeRangeStart: '',
  timeRangeEnd: '',
  visibleOnlyInTimeRange: false,
  scheduleType: 'daily',
  scheduleWeekdays: [1, 2, 3, 4, 5],
  scheduleInterval: '2',
  scheduleAnchorDate: '2025-06-30',
  useReminder: false,
  remindMinutesBefore: '15',
  showStreakOnCard: false,
  ...overrides,
});

describe('parseElementEditorSave', () => {
  it('parses counter input', () => {
    const result = parseElementEditorSave({
      mode: 'counter',
      name: ' Pushups',
      increments: '5, 10',
      dailyTarget: '50',
    });

    expect(result).toEqual({
      kind: 'counter',
      input: {
        name: ' Pushups',
        quickIncrements: [5, 10],
        dailyTarget: 50,
      },
    });
  });

  it('parses timer sound from bundled track', () => {
    const result = parseElementEditorSave(
      habitSaveData({
        habitTrackingMode: 'timer',
        habitSoundTrackId: 'meditation15min',
        habitSoundPlaybackMode: 'play_once',
      }),
    );

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.timerSound).toEqual({
      trackId: 'meditation15min',
      playbackMode: 'play_once',
    });
  });

  it('parses boolean streak display option', () => {
    const result = parseElementEditorSave(
      habitSaveData({
        showStreakOnCard: true,
      }),
    );

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.showStreakOnCard).toBe(true);
  });

  it('parses timer streak display option', () => {
    const result = parseElementEditorSave(
      habitSaveData({
        habitTrackingMode: 'timer',
        habitDailyGoalMinutes: '15',
        habitSoundTrackId: 'meditation15min',
        showStreakOnCard: true,
      }),
    );

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.showStreakOnCard).toBe(true);
  });

  it('rejects invalid increments', () => {
    expect(() =>
      parseElementEditorSave({
        mode: 'counter',
        name: 'Test',
        increments: 'abc',
        dailyTarget: '',
      }),
    ).toThrow(/positive number/);
  });
});
