import {
  HabitConfigSchema,
  shouldShowHabitOnHabitsPage,
} from '../src/protocol';
import {
  isWithinTimeRange,
  parseTimeHHmm,
} from '../src/utils/time';

describe('parseTimeHHmm', () => {
  it('normalizes flexible time input', () => {
    expect(parseTimeHHmm('6:30')).toBe('06:30');
    expect(parseTimeHHmm('0630')).toBe('06:30');
    expect(parseTimeHHmm('06:30')).toBe('06:30');
  });

  it('rejects invalid times', () => {
    expect(parseTimeHHmm('25:00')).toBeNull();
    expect(parseTimeHHmm('')).toBeNull();
  });
});

describe('isWithinTimeRange', () => {
  const at = (hours: number, minutes: number) => new Date(2025, 0, 1, hours, minutes);

  it('matches same-day ranges', () => {
    expect(isWithinTimeRange(at(7, 0), '06:00', '09:00')).toBe(true);
    expect(isWithinTimeRange(at(9, 0), '06:00', '09:00')).toBe(false);
    expect(isWithinTimeRange(at(5, 59), '06:00', '09:00')).toBe(false);
  });

  it('matches ranges that wrap past midnight', () => {
    expect(isWithinTimeRange(at(23, 0), '22:00', '06:00')).toBe(true);
    expect(isWithinTimeRange(at(5, 0), '22:00', '06:00')).toBe(true);
    expect(isWithinTimeRange(at(12, 0), '22:00', '06:00')).toBe(false);
  });
});

describe('shouldShowHabitOnHabitsPage', () => {
  const at = (hours: number, minutes: number) => new Date(2025, 0, 1, hours, minutes);

  it('always shows habits without scheduled visibility', () => {
    const config = HabitConfigSchema.parse({ timeSlot: 'morning' });
    expect(shouldShowHabitOnHabitsPage(config, at(12, 0))).toBe(true);
  });

  it('hides habits outside their scheduled window', () => {
    const config = HabitConfigSchema.parse({
      timeSlot: 'morning',
      timeRange: { start: '06:00', end: '09:00' },
      visibleOnlyInTimeRange: true,
    });
    expect(shouldShowHabitOnHabitsPage(config, at(7, 0))).toBe(true);
    expect(shouldShowHabitOnHabitsPage(config, at(12, 0))).toBe(false);
  });

  it('shows habits with a time range but no visibility limit', () => {
    const config = HabitConfigSchema.parse({
      timeSlot: 'morning',
      timeRange: { start: '06:00', end: '09:00' },
    });
    expect(shouldShowHabitOnHabitsPage(config, at(12, 0))).toBe(true);
  });
});
