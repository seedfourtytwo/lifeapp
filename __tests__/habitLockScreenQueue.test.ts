import {
  filterHabitsDueToday,
  orderHabitsList,
  type ElementDefinition,
} from '../src/protocol';

describe('lock screen habit queue ordering', () => {
  const habits: ElementDefinition[] = [
    {
      id: 'a',
      kind: 'habit',
      name: 'Mobility',
      config: {
        trackingMode: 'timer',
        timeSlot: 'anytime',
        schedule: { type: 'daily' },
      },
      protocolVersion: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      archivedAt: null,
    },
    {
      id: 'b',
      kind: 'habit',
      name: 'Breathwork',
      config: {
        trackingMode: 'timer',
        timeSlot: 'anytime',
        schedule: { type: 'daily' },
      },
      protocolVersion: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      archivedAt: null,
    },
    {
      id: 'c',
      kind: 'habit',
      name: 'Walk',
      config: {
        trackingMode: 'boolean',
        timeSlot: 'anytime',
        schedule: { type: 'daily' },
      },
      protocolVersion: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      archivedAt: null,
    },
  ];

  it('keeps remaining habits ahead of done ones', () => {
    const ordered = orderHabitsList(habits, { b: true });
    expect(ordered.map((h) => h.id)).toEqual(['a', 'c', 'b']);
  });

  it('filters to habits due today', () => {
    const due = filterHabitsDueToday(habits, {
      now: new Date('2025-06-15T10:00:00'),
      today: '2025-06-15',
      habitDoneToday: {},
    });
    expect(due.map((h) => h.id)).toEqual(['a', 'b', 'c']);
  });
});
