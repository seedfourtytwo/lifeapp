import { formatCounterStreakLabel } from '../src/kinds/counter/counterCardLabels';
import { CounterConfigSchema } from '../src/protocol';

describe('formatCounterStreakLabel', () => {
  const withTarget = CounterConfigSchema.parse({
    unit: 'reps',
    quickIncrements: [5],
    dailyTarget: 50,
    showStreakOnCard: true,
  });
  const hidden = CounterConfigSchema.parse({
    unit: 'reps',
    quickIncrements: [5],
    dailyTarget: 50,
    showStreakOnCard: false,
  });
  const noTarget = CounterConfigSchema.parse({
    unit: 'reps',
    quickIncrements: [5],
  });

  it('shows streak when target exists and count is positive', () => {
    expect(formatCounterStreakLabel(withTarget, 3)).toBe('3-day streak');
    expect(formatCounterStreakLabel(withTarget, 1)).toBe('1-day streak');
  });

  it('hides when count is zero, opted out, or no target', () => {
    expect(formatCounterStreakLabel(withTarget, 0)).toBeNull();
    expect(formatCounterStreakLabel(hidden, 5)).toBeNull();
    expect(formatCounterStreakLabel(noTarget, 5)).toBeNull();
  });

  it('defaults to showing when showStreakOnCard is omitted but target is set', () => {
    const defaultsOn = CounterConfigSchema.parse({
      unit: 'steps',
      quickIncrements: [1000],
      dailyTarget: 8000,
    });
    expect(formatCounterStreakLabel(defaultsOn, 2)).toBe('2-day streak');
  });
});
