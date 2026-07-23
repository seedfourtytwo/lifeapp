import {
  formatHabitStreakLabel,
  formatHabitCardDescription,
  getHabitStreakDays,
} from '../src/kinds/habit/habitCardLabels';
import { HabitConfigSchema } from '../src/protocol';

describe('getHabitStreakDays', () => {
  const withStreak = HabitConfigSchema.parse({
    timeSlot: 'anytime',
    showStreakOnCard: true,
  });
  const hidden = HabitConfigSchema.parse({
    timeSlot: 'anytime',
    showStreakOnCard: false,
  });

  it('returns compact day count for the card', () => {
    expect(getHabitStreakDays(withStreak, 3)).toBe(3);
    expect(getHabitStreakDays(withStreak, 1)).toBe(1);
  });

  it('hides streak when count is zero or opted out', () => {
    expect(getHabitStreakDays(withStreak, 0)).toBeNull();
    expect(getHabitStreakDays(withStreak)).toBeNull();
    expect(getHabitStreakDays(hidden, 5)).toBeNull();
  });
});

describe('formatHabitStreakLabel', () => {
  const withStreak = HabitConfigSchema.parse({
    timeSlot: 'anytime',
    showStreakOnCard: true,
  });
  const hidden = HabitConfigSchema.parse({
    timeSlot: 'anytime',
    showStreakOnCard: false,
  });

  it('shows success streak even when today is not done (streak through yesterday)', () => {
    expect(formatHabitStreakLabel(withStreak, 3)).toBe('3-day streak');
    expect(formatHabitStreakLabel(withStreak, 1)).toBe('1-day streak');
  });

  it('hides streak when count is zero', () => {
    expect(formatHabitStreakLabel(withStreak, 0)).toBeNull();
    expect(formatHabitStreakLabel(withStreak)).toBeNull();
  });

  it('respects opt-out', () => {
    expect(formatHabitStreakLabel(hidden, 5)).toBeNull();
  });

  it('defaults to showing when showStreakOnCard is omitted', () => {
    const defaultsOn = HabitConfigSchema.parse({ timeSlot: 'anytime' });
    expect(formatHabitStreakLabel(defaultsOn, 2)).toBe('2-day streak');
  });
});

describe('formatHabitCardDescription', () => {
  it('trims empty descriptions', () => {
    expect(formatHabitCardDescription(undefined)).toBeNull();
    expect(formatHabitCardDescription('  ')).toBeNull();
    expect(formatHabitCardDescription(' Morning ')).toBe('Morning');
  });
});
