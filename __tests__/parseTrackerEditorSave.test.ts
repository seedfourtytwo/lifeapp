import type { TrackerEditorSaveData } from '../src/components/trackerEditor/types';
import { parseTrackerEditorSave } from '../src/utils/parseTrackerEditorSave';

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
  useReminder: false,
  remindMinutesBefore: '15',
  reminderTimes: [],
  reminderTimeDraft: '',
  showStreakOnCard: false,
  lockScreenName: '',
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
    expect(result.kind).toBe('counter');
    if (result.kind !== 'counter') return;
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

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.timerSound).toEqual({
      trackId: 'meditation15min',
      playbackMode: 'play_once',
    });
  });

  it('saves a lock-screen name, and none when it is left empty', () => {
    const named = parseTrackerEditorSave(habitSaveData({ lockScreenName: '  Evening  ' }));
    const unnamed = parseTrackerEditorSave(habitSaveData({ lockScreenName: '   ' }));

    expect(named.kind === 'habit' && named.input.lockScreenName).toBe('Evening');
    expect(unnamed.kind === 'habit' && unnamed.input.lockScreenName).toBeUndefined();
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

  it('persists streak display off when toggled off', () => {
    const result = parseTrackerEditorSave(
      habitSaveData({
        showStreakOnCard: false,
      }),
    );

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.showStreakOnCard).toBe(false);
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

  it('parses habit icon when selected', () => {
    const result = parseTrackerEditorSave(
      habitSaveData({
        icon: 'meditation',
      }),
    );

    expect(result.kind).toBe('habit');
    if (result.kind !== 'habit') return;
    expect(result.input.icon).toBe('meditation');
  });

  it('rejects invalid increments', () => {
    expect(() =>
      parseTrackerEditorSave({
        mode: 'counter',
        name: 'Test',
        icon: null,
        increments: 'abc',
        dailyTarget: '',
        showStreakOnCard: true,
      }),
    ).toThrow(/positive number/);
  });
});

describe('parseTrackerEditorSave — commitment', () => {
  const commitment = {
    mode: 'commitment' as const,
    name: 'No buying',
    lockScreenName: '',
    ownLines: ['I sleep better'],
    ownLineDraft: '',
    insteadHabitIds: [],
    clearSinceAt: null as string | null,
    clearSinceDate: '',
    clearSinceTime: '',
    rideMinutes: 10,
  };

  it('keeps a line still in the field, so Save does not lose it', () => {
    expect(parseTrackerEditorSave({ ...commitment, ownLineDraft: ' Money for the trip ' })).toEqual({
      kind: 'commitment',
      input: {
        name: 'No buying',
        lockScreenName: '',
        ownLines: ['I sleep better', 'Money for the trip'],
        insteadHabitIds: [],
        clearSince: undefined,
        rideSeconds: 600,
      },
    });
  });

  it('refuses a line longer than eighty characters', () => {
    expect(() => parseTrackerEditorSave({ ...commitment, ownLineDraft: 'x'.repeat(81) })).toThrow(
      'Keep each line to 80 characters',
    );
  });

  describe('when the clock started', () => {
    const previousTz = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = 'Europe/Paris';
      jest.useFakeTimers({ now: new Date('2026-03-10T20:00:00.000Z') });
    });
    afterAll(() => {
      jest.useRealTimers();
      process.env.TZ = previousTz;
    });

    const clock = (fields: Partial<typeof commitment>) =>
      (parseTrackerEditorSave({ ...commitment, ...fields }) as { input: { clearSince?: string } }).input.clearSince;

    it('leaves it alone when both fields are empty (a new one starts now)', () => {
      expect(clock({})).toBeUndefined();
    });

    it('takes a local date and time in the past', () => {
      expect(clock({ clearSinceDate: '2026-03-08', clearSinceTime: '22:30' })).toBe('2026-03-08T21:30:00.000Z');
    });

    it('keeps the exact instant when the fields still show it', () => {
      const at = '2026-03-08T21:30:42.123Z';
      expect(clock({ clearSinceAt: at, clearSinceDate: '2026-03-08', clearSinceTime: '22:30' })).toBe(at);
    });

    it('refuses a moment still to come', () => {
      expect(() => clock({ clearSinceDate: '2026-03-10', clearSinceTime: '21:30' })).toThrow(
        'The clock cannot start in the future',
      );
    });

    it('refuses a date or time it cannot read', () => {
      expect(() => clock({ clearSinceDate: '2026-02-30', clearSinceTime: '10:00' })).toThrow(
        'Enter the date as YYYY-MM-DD and the time as HH:mm',
      );
      expect(() => clock({ clearSinceDate: '2026-03-08', clearSinceTime: '' })).toThrow(
        'Enter the date as YYYY-MM-DD and the time as HH:mm',
      );
    });
  });

  it('carries the ride length in seconds', () => {
    expect(
      (parseTrackerEditorSave({ ...commitment, rideMinutes: 25 }) as { input: { rideSeconds?: number } }).input
        .rideSeconds,
    ).toBe(1500);
  });
});
