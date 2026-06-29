import {
  daysBetween,
  formatScheduleDescription,
  isScheduleActiveOnDate,
  isScheduleSupportedForReminders,
  isTimeRangeStartingSoon,
  toExpoWeekday,
} from '../src/protocol/schedule';

describe('isScheduleActiveOnDate', () => {
  it('daily is always active', () => {
    expect(isScheduleActiveOnDate({ type: 'daily' }, '2025-06-29')).toBe(true);
  });

  it('weekdays matches selected days', () => {
    const schedule = { type: 'weekdays' as const, days: [1, 3, 5] };
    expect(isScheduleActiveOnDate(schedule, '2025-06-30')).toBe(true); // Monday
    expect(isScheduleActiveOnDate(schedule, '2025-07-01')).toBe(false); // Tuesday
  });

  it('every_n_days respects anchor and interval', () => {
    const schedule = {
      type: 'every_n_days' as const,
      interval: 2,
      anchorDate: '2025-06-29',
    };
    expect(isScheduleActiveOnDate(schedule, '2025-06-29')).toBe(true);
    expect(isScheduleActiveOnDate(schedule, '2025-06-30')).toBe(false);
    expect(isScheduleActiveOnDate(schedule, '2025-07-01')).toBe(true);
    expect(isScheduleActiveOnDate(schedule, '2025-06-28')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween('2025-06-29', '2025-07-01')).toBe(2);
    expect(daysBetween('2025-07-01', '2025-06-29')).toBe(-2);
  });
});

describe('formatScheduleDescription', () => {
  it('describes weekdays', () => {
    expect(
      formatScheduleDescription({ type: 'weekdays', days: [1, 5] }),
    ).toBe('Mon, Fri');
  });

  it('describes every N days', () => {
    expect(
      formatScheduleDescription({
        type: 'every_n_days',
        interval: 3,
        anchorDate: '2025-01-01',
      }),
    ).toBe('Every 3 days');
  });
});

describe('isTimeRangeStartingSoon', () => {
  it('returns true when start is within the window', () => {
    const now = new Date('2025-06-29T07:30:00');
    expect(
      isTimeRangeStartingSoon({ start: '08:00', end: '09:00' }, now, 2),
    ).toBe(true);
  });

  it('returns false when start is in the past', () => {
    const now = new Date('2025-06-29T10:00:00');
    expect(
      isTimeRangeStartingSoon({ start: '08:00', end: '09:00' }, now, 2),
    ).toBe(false);
  });
});

describe('isScheduleSupportedForReminders', () => {
  it('supports daily and weekdays only', () => {
    expect(isScheduleSupportedForReminders({ type: 'daily' })).toBe(true);
    expect(isScheduleSupportedForReminders({ type: 'weekdays', days: [1] })).toBe(true);
    expect(
      isScheduleSupportedForReminders({
        type: 'every_n_days',
        interval: 2,
        anchorDate: '2025-01-01',
      }),
    ).toBe(false);
  });
});

describe('toExpoWeekday', () => {
  it('maps JS Sunday=0 to Expo Sunday=1', () => {
    expect(toExpoWeekday(0)).toBe(1);
    expect(toExpoWeekday(6)).toBe(7);
  });
});
