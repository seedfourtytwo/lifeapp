import { PROTOCOL_VERSION, TodoSchema } from '../src/protocol';
import { countUnfinishedTrackersToday } from '../src/notifications/unfinishedTrackers';
import type { ElementDefinition, Todo } from '../src/protocol';

const habitId = '550e8400-e29b-41d4-a716-446655440010';
const counterId = '550e8400-e29b-41d4-a716-446655440011';
const counterNoTargetId = '550e8400-e29b-41d4-a716-446655440012';

const habit: ElementDefinition = {
  id: habitId,
  kind: 'habit',
  name: 'Meditate',
  config: {
    timeSlot: 'anytime',
    trackingMode: 'boolean',
    schedule: { type: 'daily' },
  },
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt: null,
};

const counterWithTarget: ElementDefinition = {
  id: counterId,
  kind: 'counter',
  name: 'Push-ups',
  config: {
    unit: 'reps',
    quickIncrements: [5, 10],
    dailyTarget: 50,
  },
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt: null,
};

const counterWithoutTarget: ElementDefinition = {
  id: counterNoTargetId,
  kind: 'counter',
  name: 'Steps',
  config: {
    unit: 'steps',
    quickIncrements: [1000],
  },
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt: null,
};

describe('countUnfinishedTrackersToday', () => {
  const now = new Date(2025, 0, 15, 18, 0, 0);

  it('counts undone habits and counters under target', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [habit, counterWithTarget, counterWithoutTarget],
        habitDoneToday: {},
        dailyTotals: { [counterId]: 20 },
        now,
      }),
    ).toEqual({ habits: 1, counters: 1, todos: 0, total: 2 });
  });

  it('ignores completed habits and met counter targets', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [habit, counterWithTarget],
        habitDoneToday: { [habitId]: true },
        dailyTotals: { [counterId]: 50 },
        now,
      }),
    ).toEqual({ habits: 0, counters: 0, todos: 0, total: 0 });
  });

  it('ignores archived trackers', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [
          { ...habit, archivedAt: '2025-01-01T00:00:00.000Z' },
          { ...counterWithTarget, archivedAt: '2025-01-01T00:00:00.000Z' },
        ],
        habitDoneToday: {},
        dailyTotals: {},
        now,
      }),
    ).toEqual({ habits: 0, counters: 0, todos: 0, total: 0 });
  });
});

describe('countUnfinishedTrackersToday — todos', () => {
  const now = new Date(2025, 0, 15, 18, 0, 0);

  let todoSeq = 0;
  function todo(overrides: Partial<Todo> = {}): Todo {
    todoSeq += 1;
    return TodoSchema.parse({
      id: `550e8400-e29b-41d4-a716-4466554${String(500 + todoSeq).padStart(5, '0')}`,
      title: `Todo ${todoSeq}`,
      sortOrder: todoSeq,
      createdAt: '2025-01-01T00:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      ...overrides,
    });
  }

  function count(todos: Todo[]) {
    return countUnfinishedTrackersToday({
      elements: [],
      habitDoneToday: {},
      dailyTotals: {},
      todos,
      now,
    });
  }

  it('counts open todos due today or already overdue', () => {
    expect(count([todo({ dueDate: '2025-01-15' }), todo({ dueDate: '2025-01-10' })])).toMatchObject({
      todos: 2,
      total: 2,
    });
  });

  it('ignores todos with no deadline — they never nag', () => {
    expect(count([todo(), todo()])).toMatchObject({ todos: 0, total: 0 });
  });

  it('ignores todos due later', () => {
    expect(count([todo({ dueDate: '2025-02-01' })])).toMatchObject({ todos: 0 });
  });

  it('ignores todos already ticked off', () => {
    expect(
      count([todo({ dueDate: '2025-01-15', completedAt: '2025-01-15T10:00:00.000Z' })]),
    ).toMatchObject({ todos: 0 });
  });

  it('adds todos to the tracker total', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [habit],
        habitDoneToday: {},
        dailyTotals: {},
        todos: [todo({ dueDate: '2025-01-15' })],
        now,
      }),
    ).toMatchObject({ habits: 1, todos: 1, total: 2 });
  });

  it('treats a missing todo list as none', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [habit],
        habitDoneToday: {},
        dailyTotals: {},
        now,
      }),
    ).toMatchObject({ habits: 1, todos: 0, total: 1 });
  });
});
