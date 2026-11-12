import { habitReminderClockTimes } from '../src/notifications/habitStartReminderTimes';
import type { HabitConfig } from '../src/protocol';
import { parseEveningCheckInTime } from '../src/protocol/appSettings';

const dailyTimed: HabitConfig = {
  trackingMode: 'boolean',
  timeSlot: 'morning',
  schedule: { type: 'daily' },
  timeRange: { start: '07:00', end: '08:00' },
  remindMinutesBefore: 15,
  reminderTimes: [],
};

describe('habitReminderClockTimes', () => {
  it('adds the reminder before the time window to the habit’s own times', () => {
    expect(habitReminderClockTimes({ ...dailyTimed, reminderTimes: ['20:00'] })).toEqual([
      '06:45',
      '20:00',
    ]);
  });

  it('counts a time named twice once', () => {
    expect(habitReminderClockTimes({ ...dailyTimed, reminderTimes: ['06:45'] })).toEqual([
      '06:45',
    ]);
  });

  it('has no window reminder for an every-n-days schedule', () => {
    expect(
      habitReminderClockTimes({
        ...dailyTimed,
        schedule: { type: 'every_n_days', interval: 2, anchorDate: '2026-11-01' },
      }),
    ).toEqual([]);
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
