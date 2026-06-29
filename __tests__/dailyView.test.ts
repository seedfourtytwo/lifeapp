import {
  filterHabitsForDailyView,
  isHabitDueToday,
  PROTOCOL_VERSION,
  type ElementDefinition,
} from '../src/protocol';

const habit = (
  id: string,
  overrides: Record<string, unknown> = {},
): ElementDefinition => ({
  id,
  kind: 'habit',
  name: `Habit ${id}`,
  category: 'habit',
  config: {
    timeSlot: 'anytime',
    schedule: { type: 'daily' },
    ...overrides,
  },
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
});

describe('isHabitDueToday', () => {
  it('respects weekday schedule', () => {
    const config = {
      trackingMode: 'boolean' as const,
      timeSlot: 'anytime' as const,
      schedule: { type: 'weekdays' as const, days: [1] },
    };
    const monday = new Date('2025-06-30T12:00:00');
    const tuesday = new Date('2025-07-01T12:00:00');

    expect(isHabitDueToday(config, { now: monday, today: '2025-06-30' })).toBe(true);
    expect(isHabitDueToday(config, { now: tuesday, today: '2025-07-01' })).toBe(false);
  });
});

describe('filterHabitsForDailyView', () => {
  const now = new Date('2025-06-30T08:00:00');
  const context = {
    now,
    today: '2025-06-30',
    habitDoneToday: { a: true, b: false },
  };

  it('all_due returns scheduled habits for today', () => {
    const habits = [
      habit('a'),
      habit('c', { schedule: { type: 'weekdays', days: [2] } }),
    ];
    const result = filterHabitsForDailyView(habits, 'all_due', context);
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('undone filters completed habits', () => {
    const habits = [habit('a'), habit('b')];
    const result = filterHabitsForDailyView(habits, 'undone', context);
    expect(result.map((item) => item.id)).toEqual(['b']);
  });

  it('starting_soon requires a time range starting within the window', () => {
    const habits = [
      habit('soon', { timeRange: { start: '08:30', end: '09:00' } }),
      habit('later', { timeRange: { start: '14:00', end: '15:00' } }),
    ];
    const result = filterHabitsForDailyView(habits, 'starting_soon', context);
    expect(result.map((item) => item.id)).toEqual(['soon']);
  });

  it('all shows habits regardless of schedule but respects visibility window', () => {
    const habits = [
      habit('hidden', {
        timeRange: { start: '14:00', end: '15:00' },
        visibleOnlyInTimeRange: true,
      }),
      habit('visible'),
    ];
    const result = filterHabitsForDailyView(habits, 'all', context);
    expect(result.map((item) => item.id)).toEqual(['visible']);
  });
});
