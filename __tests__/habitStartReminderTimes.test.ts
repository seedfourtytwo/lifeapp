import { collectStartReminderFires } from '../src/notifications/habitStartReminderTimes';
import type { HabitConfig } from '../src/protocol';
import { parseEveningCheckInTime } from '../src/protocol/appSettings';

const dailyTimed: HabitConfig = {
  trackingMode: 'boolean',
  timeSlot: 'morning',
  schedule: { type: 'daily' },
  timeRange: { start: '07:00', end: '08:00' },
  remindMinutesBefore: 15,
};

const weekdaysTimed: HabitConfig = {
  ...dailyTimed,
  schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
};

describe('collectStartReminderFires', () => {
  it('skips today when done, but keeps later days', () => {
    // Wednesday 6:00 — reminder would be 06:45, still ahead.
    const now = new Date(2025, 0, 15, 6, 0, 0);
    const fires = collectStartReminderFires(dailyTimed, {
      now,
      doneToday: true,
      horizonDays: 3,
    });

    expect(fires.map((f) => f.dateStr)).toEqual(['2025-01-16', '2025-01-17']);
    expect(fires[0].when.getHours()).toBe(6);
    expect(fires[0].when.getMinutes()).toBe(45);
  });

  it('includes today when not done and reminder is still ahead', () => {
    const now = new Date(2025, 0, 15, 6, 0, 0);
    const fires = collectStartReminderFires(dailyTimed, {
      now,
      doneToday: false,
      horizonDays: 2,
    });

    expect(fires.map((f) => f.dateStr)).toEqual(['2025-01-15', '2025-01-16']);
  });

  it('skips today when the reminder time already passed', () => {
    const now = new Date(2025, 0, 15, 8, 0, 0);
    const fires = collectStartReminderFires(dailyTimed, {
      now,
      doneToday: false,
      horizonDays: 2,
    });

    expect(fires.map((f) => f.dateStr)).toEqual(['2025-01-16']);
  });

  it('only schedules matching weekdays', () => {
    // Saturday
    const now = new Date(2025, 0, 18, 6, 0, 0);
    const fires = collectStartReminderFires(weekdaysTimed, {
      now,
      doneToday: false,
      horizonDays: 4,
    });

    expect(fires.map((f) => f.dateStr)).toEqual(['2025-01-20', '2025-01-21']);
  });
});

describe('parseEveningCheckInTime', () => {
  it('accepts flexible clock input', () => {
    expect(parseEveningCheckInTime('8:00')).toBe('08:00');
    expect(parseEveningCheckInTime('2000')).toBe('20:00');
    expect(parseEveningCheckInTime('19:45')).toBe('19:45');
  });

  it('rejects invalid times', () => {
    expect(parseEveningCheckInTime('25:00')).toBeNull();
    expect(parseEveningCheckInTime('abc')).toBeNull();
    expect(parseEveningCheckInTime('')).toBeNull();
  });
});
