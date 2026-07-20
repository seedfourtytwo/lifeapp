import {
  filterHabitsDueToday,
  habitTimeHintLabel,
  isHabitDueToday,
  migrateDailyViewFilter,
  orderHabitsList,
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

describe('migrateDailyViewFilter', () => {
  it('maps legacy filter ids', () => {
    expect(migrateDailyViewFilter('all_due')).toBe('all');
    expect(migrateDailyViewFilter('undone')).toBe('remaining');
    expect(migrateDailyViewFilter('starting_soon')).toBe('remaining');
    expect(migrateDailyViewFilter('remaining')).toBe('remaining');
  });
});

describe('filterHabitsDueToday', () => {
  const now = new Date('2025-06-30T08:00:00');
  const context = {
    now,
    today: '2025-06-30',
    habitDoneToday: { a: true, b: false },
  };

  it('returns scheduled habits for today', () => {
    const habits = [
      habit('a'),
      habit('c', { schedule: { type: 'weekdays', days: [2] } }),
    ];
    const result = filterHabitsDueToday(habits, context);
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('respects visibility window', () => {
    const habits = [
      habit('hidden', {
        timeRange: { start: '14:00', end: '15:00' },
        visibleOnlyInTimeRange: true,
      }),
      habit('visible'),
    ];
    const result = filterHabitsDueToday(habits, context);
    expect(result.map((item) => item.id)).toEqual(['visible']);
  });
});

describe('orderHabitsList', () => {
  it('keeps remaining first and parks done at the bottom', () => {
    const habits = [habit('a'), habit('b'), habit('c')];
    const ordered = orderHabitsList(habits, { a: true, c: false });
    expect(ordered.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('habitTimeHintLabel', () => {
  it('maps slots to quiet cues', () => {
    expect(habitTimeHintLabel('morning')).toBe('AM');
    expect(habitTimeHintLabel('afternoon')).toBe('Lunch');
    expect(habitTimeHintLabel('evening')).toBe('PM');
    expect(habitTimeHintLabel('anytime')).toBeNull();
  });
});
