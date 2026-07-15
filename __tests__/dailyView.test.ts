import {
  dailyViewUsesSlotSections,
  filterHabitsForDailyView,
  groupHabitsForDailyView,
  isHabitDueToday,
  migrateDailyViewFilter,
  parseHabitConfig,
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

describe('filterHabitsForDailyView', () => {
  const now = new Date('2025-06-30T08:00:00');
  const context = {
    now,
    today: '2025-06-30',
    habitDoneToday: { a: true, b: false },
  };

  it('all returns scheduled habits for today', () => {
    const habits = [
      habit('a'),
      habit('c', { schedule: { type: 'weekdays', days: [2] } }),
    ];
    const result = filterHabitsForDailyView(habits, 'all', context);
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('remaining filters completed habits', () => {
    const habits = [habit('a'), habit('b')];
    const result = filterHabitsForDailyView(habits, 'remaining', context);
    expect(result.map((item) => item.id)).toEqual(['b']);
  });

  it('morning returns due habits in that slot', () => {
    const habits = [
      habit('m', { timeSlot: 'morning' }),
      habit('e', { timeSlot: 'evening' }),
    ];
    const result = filterHabitsForDailyView(habits, 'morning', context);
    expect(result.map((item) => item.id)).toEqual(['m']);
  });

  it('everything shows habits regardless of schedule but respects visibility window', () => {
    const habits = [
      habit('hidden', {
        timeRange: { start: '14:00', end: '15:00' },
        visibleOnlyInTimeRange: true,
      }),
      habit('visible'),
    ];
    const result = filterHabitsForDailyView(habits, 'everything', context);
    expect(result.map((item) => item.id)).toEqual(['visible']);
  });

  it('reports which views use slot sections', () => {
    expect(dailyViewUsesSlotSections('all')).toBe(true);
    expect(dailyViewUsesSlotSections('morning')).toBe(false);
  });

  it('groups multi-slot views and flattens single-slot views', () => {
    const habits = [
      habit('m', { timeSlot: 'morning' }),
      habit('e', { timeSlot: 'evening' }),
    ];
    const configs = new Map(habits.map((item) => [item.id, parseHabitConfig(item.config)]));

    const grouped = groupHabitsForDailyView(habits, 'all', configs);
    expect(grouped.map((section) => section.slot)).toEqual(['morning', 'evening']);

    const flat = groupHabitsForDailyView(habits, 'morning', configs);
    expect(flat).toEqual([{ slot: null, items: habits }]);
  });
});
