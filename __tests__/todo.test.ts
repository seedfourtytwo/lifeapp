import {
  PROTOCOL_VERSION,
  createProtocolBundle,
  parseProtocolBundle,
  TODO_TITLE_MAX_LENGTH,
  TodoSchema,
  compareTodos,
  countTodosNeedingAttention,
  groupOpenTodos,
  isTodoOpen,
  nextTodoSortOrder,
  todoSection,
  validateBundleTodos,
} from '../src/protocol';
import type { Todo } from '../src/protocol';

const TODAY = '2026-08-24';

let seq = 0;
function todo(overrides: Partial<Todo> = {}): Todo {
  seq += 1;
  return TodoSchema.parse({
    id: `550e8400-e29b-41d4-a716-4466554${String(400 + seq).padStart(5, '0')}`,
    title: `Todo ${seq}`,
    sortOrder: seq,
    createdAt: '2026-08-01T09:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...overrides,
  });
}

beforeEach(() => {
  seq = 0;
});

describe('TodoSchema', () => {
  it('needs a title with something in it', () => {
    expect(() => todo({ title: '' })).toThrow();
    expect(() => todo({ title: '   ' })).toThrow();
  });

  it('trims the title', () => {
    expect(todo({ title: '  Call the dentist  ' }).title).toBe('Call the dentist');
  });

  it('rejects a title past the limit but accepts one at it', () => {
    expect(todo({ title: 'x'.repeat(TODO_TITLE_MAX_LENGTH) }).title).toHaveLength(
      TODO_TITLE_MAX_LENGTH,
    );
    expect(() => todo({ title: 'x'.repeat(TODO_TITLE_MAX_LENGTH + 1) })).toThrow();
  });

  it('normalises absent note, deadline, and completion to null', () => {
    const parsed = todo();
    expect(parsed.note).toBeNull();
    expect(parsed.dueDate).toBeNull();
    expect(parsed.completedAt).toBeNull();
  });

  it('accepts a date-only deadline and rejects a timestamp', () => {
    expect(todo({ dueDate: '2026-09-01' }).dueDate).toBe('2026-09-01');
    expect(() => todo({ dueDate: '2026-09-01T10:00:00.000Z' })).toThrow();
    expect(() => todo({ dueDate: '2026-9-1' })).toThrow();
  });

  it('rejects a completion timestamp that is not a timestamp', () => {
    expect(() => todo({ completedAt: '2026-08-24' })).toThrow();
  });
});

describe('isTodoOpen', () => {
  it('is open until completedAt is set', () => {
    expect(isTodoOpen(todo())).toBe(true);
    expect(isTodoOpen(todo({ completedAt: '2026-08-24T18:00:00.000Z' }))).toBe(false);
  });
});

describe('todoSection', () => {
  it('files a todo by its deadline against today', () => {
    expect(todoSection(todo({ dueDate: '2026-08-23' }), TODAY)).toBe('overdue');
    expect(todoSection(todo({ dueDate: TODAY }), TODAY)).toBe('today');
    expect(todoSection(todo({ dueDate: '2026-08-25' }), TODAY)).toBe('later');
    expect(todoSection(todo(), TODAY)).toBe('undated');
  });

  it('treats a deadline as due all day — it is overdue only once the day is past', () => {
    const due = todo({ dueDate: '2026-08-24' });
    expect(todoSection(due, '2026-08-24')).toBe('today');
    expect(todoSection(due, '2026-08-25')).toBe('overdue');
  });

  it('compares dates as calendar days, not string prefixes', () => {
    expect(todoSection(todo({ dueDate: '2026-09-01' }), '2026-08-31')).toBe('later');
    expect(todoSection(todo({ dueDate: '2025-12-31' }), '2026-01-01')).toBe('overdue');
  });
});

describe('compareTodos', () => {
  it('orders overdue before today before later before undated', () => {
    const undated = todo();
    const later = todo({ dueDate: '2026-09-10' });
    const today = todo({ dueDate: TODAY });
    const overdue = todo({ dueDate: '2026-08-01' });

    const sorted = [undated, later, today, overdue].sort((a, b) => compareTodos(a, b, TODAY));

    expect(sorted.map((t) => todoSection(t, TODAY))).toEqual([
      'overdue',
      'today',
      'later',
      'undated',
    ]);
  });

  it('puts the oldest deadline first inside a section', () => {
    const soon = todo({ dueDate: '2026-08-26', sortOrder: 99 });
    const later = todo({ dueDate: '2026-09-30', sortOrder: 1 });

    expect([later, soon].sort((a, b) => compareTodos(a, b, TODAY))).toEqual([soon, later]);
  });

  it('falls back to manual order for the same deadline', () => {
    const first = todo({ dueDate: '2026-08-26', sortOrder: 1 });
    const second = todo({ dueDate: '2026-08-26', sortOrder: 2 });

    expect([second, first].sort((a, b) => compareTodos(a, b, TODAY))).toEqual([first, second]);
  });

  it('orders undated todos by manual order alone', () => {
    const first = todo({ sortOrder: 1 });
    const second = todo({ sortOrder: 2 });

    expect([second, first].sort((a, b) => compareTodos(a, b, TODAY))).toEqual([first, second]);
  });

  it('is stable for two todos that tie on everything sortable', () => {
    const a = todo({ sortOrder: 5 });
    const b = todo({ sortOrder: 5 });

    expect(compareTodos(a, b, TODAY)).toBe(0);
  });
});

describe('groupOpenTodos', () => {
  it('drops completed todos and empty sections', () => {
    const groups = groupOpenTodos(
      [
        todo({ dueDate: '2026-08-01' }),
        todo({ completedAt: '2026-08-24T10:00:00.000Z' }),
        todo(),
      ],
      TODAY,
    );

    expect(groups.map((group) => group.section)).toEqual(['overdue', 'undated']);
    expect(groups.flatMap((group) => group.todos)).toHaveLength(2);
  });

  it('returns nothing when every todo is done', () => {
    expect(groupOpenTodos([todo({ completedAt: '2026-08-24T10:00:00.000Z' })], TODAY)).toEqual([]);
  });

  it('sorts within each section', () => {
    const [group] = groupOpenTodos(
      [todo({ sortOrder: 3 }), todo({ sortOrder: 1 }), todo({ sortOrder: 2 })],
      TODAY,
    );

    expect(group.todos.map((t) => t.sortOrder)).toEqual([1, 2, 3]);
  });
});

describe('countTodosNeedingAttention', () => {
  it('counts open overdue and due-today todos only', () => {
    const count = countTodosNeedingAttention(
      [
        todo({ dueDate: '2026-08-01' }),
        todo({ dueDate: TODAY }),
        todo({ dueDate: '2026-12-01' }),
        todo(),
        todo({ dueDate: TODAY, completedAt: '2026-08-24T10:00:00.000Z' }),
      ],
      TODAY,
    );

    expect(count).toBe(2);
  });

  it('is zero when nothing has a deadline', () => {
    expect(countTodosNeedingAttention([todo(), todo()], TODAY)).toBe(0);
  });
});

describe('nextTodoSortOrder', () => {
  it('lands after every existing todo', () => {
    expect(nextTodoSortOrder([todo({ sortOrder: 3 }), todo({ sortOrder: 7 })])).toBe(8);
  });

  it('starts at zero for an empty list', () => {
    expect(nextTodoSortOrder([])).toBe(0);
  });

  it('ignores completed todos holding high sort orders', () => {
    expect(
      nextTodoSortOrder([
        todo({ sortOrder: 2 }),
        todo({ sortOrder: 900, completedAt: '2026-08-24T10:00:00.000Z' }),
      ]),
    ).toBe(3);
  });
});

describe('validateBundleTodos', () => {
  it('accepts an empty list', () => {
    expect(() => validateBundleTodos([])).not.toThrow();
  });

  it('rejects duplicate ids', () => {
    const one = todo();
    expect(() => validateBundleTodos([one, { ...one, title: 'Copy' }])).toThrow(/[Dd]uplicate/);
  });

  it('accepts distinct todos', () => {
    expect(() => validateBundleTodos([todo(), todo()])).not.toThrow();
  });
});

describe('backup bundle', () => {
  it('carries todos through export and re-parse', () => {
    const todos = [todo({ dueDate: '2026-09-01' }), todo({ completedAt: '2026-08-24T18:00:00.000Z' })];
    const bundle = createProtocolBundle({ elements: [], dashboard: [], events: [], todos });

    expect(parseProtocolBundle(bundle).todos).toEqual(todos);
  });

  it('leaves the key out entirely when there are no todos', () => {
    const bundle = createProtocolBundle({ elements: [], dashboard: [], events: [], todos: [] });

    expect(bundle).not.toHaveProperty('todos');
  });

  it('still reads a backup taken before todos existed', () => {
    const older = {
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      elements: [],
      dashboard: [],
      events: [],
    };

    expect(parseProtocolBundle(older).todos).toBeUndefined();
  });

  it('rejects a bundle with the same todo twice', () => {
    const one = todo();
    expect(() =>
      parseProtocolBundle({
        protocolVersion: PROTOCOL_VERSION,
        exportedAt: '2026-01-01T00:00:00.000Z',
        elements: [],
        dashboard: [],
        events: [],
        todos: [one, one],
      }),
    ).toThrow(/[Dd]uplicate/);
  });
});
