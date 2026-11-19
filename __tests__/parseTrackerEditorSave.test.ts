import type { TrackerEditorSaveData } from '../src/components/trackerEditor/types';
import {
  parseTrackerEditorSave,
  type TrackerEditorField,
} from '../src/utils/parseTrackerEditorSave';

const habitSaveData = (
  overrides: Partial<Extract<TrackerEditorSaveData, { mode: 'habit' }>> = {},
): Extract<TrackerEditorSaveData, { mode: 'habit' }> => ({
  mode: 'habit',
  name: 'Meditation',
  icon: null,
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
  scheduleTimesPerWeek: '3',
  useReminder: false,
  remindMinutesBefore: '15',
  showStreakOnCard: false,
  anySessionCounts: false,
  ...overrides,
});

describe('parseTrackerEditorSave', () => {
  it('parses counter input', () => {
    const result = parseTrackerEditorSave({
      mode: 'counter',
      name: ' Pushups',
      icon: 'dumbbell',
      increments: '5, 10',
      dailyTarget: '50',
      showStreakOnCard: true,
    });

    expect(result).toEqual({
      ok: true,
      kind: 'counter',
      input: {
        name: ' Pushups',
        icon: 'dumbbell',
        quickIncrements: [5, 10],
        dailyTarget: 50,
        showStreakOnCard: true,
      },
    });
  });

  it('parses counter streak display option', () => {
    const result = parseTrackerEditorSave({
      mode: 'counter',
      name: 'Steps',
      icon: null,
      increments: '1000',
      dailyTarget: '8000',
      showStreakOnCard: false,
    });
    if (!result.ok || result.kind !== 'counter') throw new Error('expected a counter');
    expect(result.input.showStreakOnCard).toBe(false);
    expect(result.input.icon).toBeUndefined();
  });

  it('parses timer sound from bundled track', () => {
    const result = parseTrackerEditorSave(
      habitSaveData({
        habitTrackingMode: 'timer',
        habitSoundTrackId: 'meditation15min',
        habitSoundPlaybackMode: 'play_once',
      }),
    );

    if (!result.ok || result.kind !== 'habit') throw new Error('expected a habit');
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

    if (!result.ok || result.kind !== 'habit') throw new Error('expected a habit');
    expect(result.input.showStreakOnCard).toBe(true);
  });

  it('persists streak display off when toggled off', () => {
    const result = parseTrackerEditorSave(
      habitSaveData({
        showStreakOnCard: false,
      }),
    );

    if (!result.ok || result.kind !== 'habit') throw new Error('expected a habit');
    expect(result.input.showStreakOnCard).toBe(false);
  });

  it('always saves timeSlot as anytime (slot filters removed)', () => {
    const result = parseTrackerEditorSave(habitSaveData());
    if (!result.ok || result.kind !== 'habit') throw new Error('expected a habit');
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

    if (!result.ok || result.kind !== 'habit') throw new Error('expected a habit');
    expect(result.input.showStreakOnCard).toBe(true);
  });

  it('parses habit icon when selected', () => {
    const result = parseTrackerEditorSave(
      habitSaveData({
        icon: 'meditation',
      }),
    );

    if (!result.ok || result.kind !== 'habit') throw new Error('expected a habit');
    expect(result.input.icon).toBe('meditation');
  });

  it('saves "any session counts" for a timer habit only', () => {
    const timer = parseTrackerEditorSave(
      habitSaveData({ habitTrackingMode: 'timer', habitDailyGoalMinutes: '15', anySessionCounts: true }),
    );
    expect(timer.ok && timer.kind === 'habit' && timer.input.anySessionCounts).toBe(true);

    const tick = parseTrackerEditorSave(habitSaveData({ anySessionCounts: true }));
    expect(tick.ok && tick.kind === 'habit' && tick.input.anySessionCounts).toBe(false);
  });

});

/**
 * What cannot be saved comes back as a value, not an exception: which field is
 * wrong and the sentence to put under it. The editor shows it in place and
 * scrolls there; nothing is thrown at the screen to turn into a pop-up.
 */
describe('what cannot be saved', () => {
  const counter = (overrides: { increments?: string; dailyTarget?: string }) =>
    parseTrackerEditorSave({
      mode: 'counter',
      name: 'Test',
      icon: null,
      increments: '5',
      dailyTarget: '',
      showStreakOnCard: true,
      ...overrides,
    });

  it('names the quick buttons when none is a positive number', () => {
    expect(counter({ increments: 'abc' })).toEqual({
      ok: false,
      field: 'increments',
      message: expect.stringMatching(/positive number/),
    });
  });

  it('names the daily target when it is not a positive whole number', () => {
    expect(counter({ dailyTarget: '0' })).toMatchObject({ ok: false, field: 'dailyTarget' });
    expect(counter({ dailyTarget: 'ten' })).toMatchObject({ ok: false, field: 'dailyTarget' });
    expect(counter({ dailyTarget: '' })).toMatchObject({ ok: true });
  });

  it('names the timer goal when it is not a positive number of minutes', () => {
    expect(
      parseTrackerEditorSave(
        habitSaveData({ habitTrackingMode: 'timer', habitDailyGoalMinutes: '-5' }),
      ),
    ).toMatchObject({ ok: false, field: 'dailyGoalMinutes' });
  });

  it('ignores a bad timer goal on a check-off habit, which has none', () => {
    expect(parseTrackerEditorSave(habitSaveData({ habitDailyGoalMinutes: '-5' }))).toMatchObject({
      ok: true,
    });
  });

  const badSchedules: [TrackerEditorField, Parameters<typeof habitSaveData>[0]][] = [
    ['weekdays', { scheduleType: 'weekdays', scheduleWeekdays: [] }],
    ['timesPerWeek', { scheduleType: 'times_per_week', scheduleTimesPerWeek: '7' }],
    ['timesPerWeek', { scheduleType: 'times_per_week', scheduleTimesPerWeek: '' }],
    ['interval', { scheduleType: 'every_n_days', scheduleInterval: '0' }],
    ['interval', { scheduleType: 'every_n_days', scheduleInterval: 'x' }],
    ['anchorDate', { scheduleType: 'every_n_days', scheduleAnchorDate: '30/06/2025' }],
  ];

  it.each(badSchedules)('names %s for a schedule that cannot repeat', (field, overrides) => {
    const result = parseTrackerEditorSave(habitSaveData(overrides));
    expect(result).toMatchObject({ ok: false, field });
    expect(result.ok ? '' : result.message).not.toBe('');
  });

  it('names the time range when a time is not HH:mm', () => {
    expect(
      parseTrackerEditorSave(
        habitSaveData({ useTimeRange: true, timeRangeStart: '7am', timeRangeEnd: '09:00' }),
      ),
    ).toMatchObject({ ok: false, field: 'timeRange', message: expect.stringMatching(/HH:mm/) });
  });

  it('names the time range when visibility is limited without one', () => {
    expect(
      parseTrackerEditorSave(habitSaveData({ useTimeRange: false, visibleOnlyInTimeRange: true })),
    ).toMatchObject({ ok: false, field: 'timeRange' });
  });

  it('names the reminder minutes when they are not zero or more', () => {
    const withReminder = (remindMinutesBefore: string) =>
      parseTrackerEditorSave(
        habitSaveData({
          useTimeRange: true,
          timeRangeStart: '07:00',
          timeRangeEnd: '09:00',
          useReminder: true,
          remindMinutesBefore,
        }),
      );
    expect(withReminder('-1')).toMatchObject({ ok: false, field: 'remindMinutesBefore' });
    expect(withReminder('soon')).toMatchObject({ ok: false, field: 'remindMinutesBefore' });
    const ok = withReminder('0');
    expect(ok.ok && ok.kind === 'habit' && ok.input.remindMinutesBefore).toBe(0);
  });

  it('keeps a reminder on an every-N-days habit: those fire as one-shot dates', () => {
    const result = parseTrackerEditorSave(
      habitSaveData({
        scheduleType: 'every_n_days',
        scheduleInterval: '3',
        useTimeRange: true,
        timeRangeStart: '07:00',
        timeRangeEnd: '09:00',
        useReminder: true,
        remindMinutesBefore: '10',
      }),
    );
    expect(result.ok && result.kind === 'habit' && result.input.remindMinutesBefore).toBe(10);
  });

  it('reports the first problem in the order the form reads', () => {
    expect(
      parseTrackerEditorSave(
        habitSaveData({
          scheduleType: 'weekdays',
          scheduleWeekdays: [],
          useTimeRange: true,
          timeRangeStart: 'x',
          timeRangeEnd: 'y',
        }),
      ),
    ).toMatchObject({ ok: false, field: 'weekdays' });
  });
});
