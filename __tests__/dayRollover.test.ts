import {
  currentAppCalendarDate,
  hasAppCalendarDayChanged,
  msUntilNextAppDay,
} from '../src/utils/dayRollover';

describe('dayRollover', () => {
  it('detects when the local calendar date changes', () => {
    const morning = new Date(2026, 6, 15, 8, 0, 0);
    const evening = new Date(2026, 6, 15, 22, 0, 0);
    const nextDay = new Date(2026, 6, 16, 0, 5, 0);

    expect(currentAppCalendarDate(morning)).toBe('2026-07-15');
    expect(hasAppCalendarDayChanged('2026-07-15', evening)).toBe(false);
    expect(hasAppCalendarDayChanged('2026-07-15', nextDay)).toBe(true);
  });

  it('schedules refresh for the next local midnight', () => {
    const beforeMidnight = new Date(2026, 6, 15, 23, 30, 0);
    expect(msUntilNextAppDay(beforeMidnight)).toBe(30 * 60 * 1000);
  });
});
