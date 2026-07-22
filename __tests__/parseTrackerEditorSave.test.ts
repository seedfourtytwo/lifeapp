import type { TrackerEditorSaveData } from '../src/components/trackerEditor/types';
import { parseTrackerEditorSave } from '../src/utils/parseTrackerEditorSave';

const habitSaveData = (
  overrides: Partial<Extract<TrackerEditorSaveData, { mode: 'habit' }>> = {},
): Extract<TrackerEditorSaveData, { mode: 'habit' }> => ({
  mode: 'habit',
  name: 'Meditation',
  targetLabel: '',
  habitTrackingMode: 'boolean',
  habitDailyGoalMinutes: '',
  habitSoundTrackId: '',
  habitSoundPlaybackMode: 'play_once' as const,
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

describe('parseTrackerEditorSave', () => {
  it('parses counter input', () => {
    const result = parseTrackerEditorSave({
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
    const result = parseTrackerEditorSave(
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
    const result = parseTrackerEditorSave(
      habitSaveData({
        showStreakOnCard: true,
      }),
    );

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.showStreakOnCard).toBe(true);
  });

  it('always saves timeSlot as anytime (slot filters removed)', () => {
    const result = parseTrackerEditorSave(habitSaveData());
    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.timeSlot).toBe('anytime');
  });

  it('parses timer streak display option', () => {
    const result = parseTrackerEditorSave(
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
      parseTrackerEditorSave({
        mode: 'counter',
        name: 'Test',
        increments: 'abc',
        dailyTarget: '',
      }),
    ).toThrow(/positive number/);
  });
});
