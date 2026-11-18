import {
  daysBetween,
  formatScheduleDescription,
  isScheduleActiveOnDate,
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

  it('summarizes Mon–Fri as Weekdays', () => {
    expect(
      formatScheduleDescription({ type: 'weekdays', days: [1, 2, 3, 4, 5] }),
    ).toBe('Weekdays');
  });

  it('summarizes Sat–Sun as Weekends', () => {
    expect(
      formatScheduleDescription({ type: 'weekdays', days: [0, 6] }),
    ).toBe('Weekends');
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

describe('toExpoWeekday', () => {
  it('maps JS Sunday=0 to Expo Sunday=1', () => {
    expect(toExpoWeekday(0)).toBe(1);
    expect(toExpoWeekday(6)).toBe(7);
  });
});

describe('daysBetween across DST', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  const zones = [
    'America/New_York',
    'Europe/London',
    'Australia/Sydney',
    'Pacific/Auckland',
    'UTC',
  ];

  it.each(zones)('is a pure calendar-day difference in %s', (tz) => {
    process.env.TZ = tz;
    // Spring/autumn changes in both hemispheres.
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1);
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14);
    expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1);
    expect(daysBetween('2026-10-24', '2026-10-25')).toBe(1);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
    expect(daysBetween('2026-04-04', '2026-04-05')).toBe(1);
    expect(daysBetween('2026-09-26', '2026-09-27')).toBe(1);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(daysBetween('2026-03-08', '2026-03-07')).toBe(-1);
    expect(daysBetween('2026-03-08', '2026-03-08')).toBe(0);
  });

  it.each(zones)('every_n_days stays on cadence over a DST change in %s', (tz) => {
    process.env.TZ = tz;
    const schedule = {
      type: 'every_n_days' as const,
      interval: 2,
      anchorDate: '2026-03-01',
    };
    // 03-01 + 2k: 03-03, 03-05, 03-07, 03-09 ...
    expect(isScheduleActiveOnDate(schedule, '2026-03-07')).toBe(true);
    expect(isScheduleActiveOnDate(schedule, '2026-03-08')).toBe(false);
    expect(isScheduleActiveOnDate(schedule, '2026-03-09')).toBe(true);
    expect(isScheduleActiveOnDate(schedule, '2026-03-15')).toBe(true);
  });
});
