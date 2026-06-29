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
  habitSoundId: '',
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

  it('parses habit input with optional time range and reminder', () => {
    const result = parseElementEditorSave(
      habitSaveData({
        useTimeRange: true,
        timeRangeStart: '06:00',
        timeRangeEnd: '07:00',
        useReminder: true,
        remindMinutesBefore: '10',
      }),
    );

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.timeRange).toEqual({ start: '06:00', end: '07:00' });
    expect(result.input.remindMinutesBefore).toBe(10);
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
