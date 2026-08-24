import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { ensureTodoSchema } from '../src/db/schemaIntegrity';
import * as todoRepo from '../src/db/repositories/todoRepository';
import { PROTOCOL_VERSION, TodoSchema, type Todo } from '../src/protocol';

/** Real SQL against real SQLite — mocks cannot check constraints or ordering. */
function createTestDb(): SQLiteDatabase {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  type Bind = null | number | string;

  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).get(...params) ?? null,
  } as unknown as SQLiteDatabase;
}

let counter = 0;
function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function todo(overrides: Partial<Todo> = {}): Todo {
  return TodoSchema.parse({
    id: uuid(),
    title: 'Todo',
    sortOrder: 0,
    createdAt: '2026-08-20T09:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...overrides,
  });
}

let db: SQLiteDatabase;

beforeEach(async () => {
  counter = 0;
  db = createTestDb();
  await ensureTodoSchema(db);
});

describe('createTodo', () => {
  it('stores a bare title as an open, undated todo', async () => {
    const created = await todoRepo.createTodo(db, { title: 'Renew passport' });

    expect(created.title).toBe('Renew passport');
    expect(created.dueDate).toBeNull();
    expect(created.note).toBeNull();
    expect(created.completedAt).toBeNull();
    await expect(todoRepo.getTodo(db, created.id)).resolves.toEqual(created);
  });

  it('rejects a blank title instead of storing an unreadable row', async () => {
    await expect(todoRepo.createTodo(db, { title: '   ' })).rejects.toThrow();
  });

  it('appends new todos after existing open ones', async () => {
    const first = await todoRepo.createTodo(db, { title: 'First' });
    const second = await todoRepo.createTodo(db, { title: 'Second' });

    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
  });

  it('does not let a completed todo push the next sort order up', async () => {
    await todoRepo.insertTodo(db, todo({ sortOrder: 900, completedAt: '2026-08-20T10:00:00.000Z' }));

    await expect(todoRepo.createTodo(db, { title: 'Fresh' })).resolves.toMatchObject({
      sortOrder: 0,
    });
  });
});

describe('updateTodo', () => {
  it('changes title, note, and deadline together', async () => {
    const created = await todoRepo.createTodo(db, { title: 'Book flights' });

    const updated = await todoRepo.updateTodo(db, created.id, {
      title: 'Book flights to Lisbon',
      note: 'Aim for a morning departure',
      dueDate: '2026-09-15',
    });

    expect(updated).toMatchObject({
      title: 'Book flights to Lisbon',
      note: 'Aim for a morning departure',
      dueDate: '2026-09-15',
    });
  });

  it('clears a deadline and a note back to null', async () => {
    const created = await todoRepo.createTodo(db, {
      title: 'Thing',
      dueDate: '2026-09-15',
      note: 'Some detail',
    });

    const updated = await todoRepo.updateTodo(db, created.id, {
      title: 'Thing',
      note: null,
      dueDate: null,
    });

    expect(updated?.dueDate).toBeNull();
    expect(updated?.note).toBeNull();
  });

  it('returns null for an id that is not there', async () => {
    await expect(todoRepo.updateTodo(db, uuid(), { title: 'Ghost' })).resolves.toBeNull();
  });

  it('leaves completion alone', async () => {
    const created = await todoRepo.createTodo(db, { title: 'Thing' });
    await todoRepo.setTodoCompleted(db, created.id, '2026-08-24T18:00:00.000Z');

    const updated = await todoRepo.updateTodo(db, created.id, { title: 'Thing renamed' });

    expect(updated?.completedAt).toBe('2026-08-24T18:00:00.000Z');
  });
});

describe('setTodoCompleted', () => {
  it('ticks a todo done and takes it out of the open list', async () => {
    const created = await todoRepo.createTodo(db, { title: 'Pay rent' });

    await todoRepo.setTodoCompleted(db, created.id, '2026-08-24T18:00:00.000Z');

    await expect(todoRepo.getOpenTodos(db)).resolves.toEqual([]);
    await expect(todoRepo.getCompletedTodos(db)).resolves.toHaveLength(1);
  });

  it('undoes a mistaken tick', async () => {
    const created = await todoRepo.createTodo(db, { title: 'Pay rent' });
    await todoRepo.setTodoCompleted(db, created.id, '2026-08-24T18:00:00.000Z');

    await todoRepo.setTodoCompleted(db, created.id, null);

    await expect(todoRepo.getOpenTodos(db)).resolves.toHaveLength(1);
    await expect(todoRepo.getCompletedTodos(db)).resolves.toEqual([]);
  });

  it('returns null for an id that is not there', async () => {
    await expect(todoRepo.setTodoCompleted(db, uuid(), null)).resolves.toBeNull();
  });
});

describe('deleteTodo', () => {
  it('removes the row entirely — a deleted todo is not history', async () => {
    const created = await todoRepo.createTodo(db, { title: 'Never mind' });

    await todoRepo.deleteTodo(db, created.id);

    await expect(todoRepo.getTodo(db, created.id)).resolves.toBeNull();
    await expect(todoRepo.getAllTodos(db)).resolves.toEqual([]);
  });

  it('removes a completed todo from history too', async () => {
    const created = await todoRepo.createTodo(db, { title: 'Done then dropped' });
    await todoRepo.setTodoCompleted(db, created.id, '2026-08-24T18:00:00.000Z');

    await todoRepo.deleteTodo(db, created.id);

    await expect(todoRepo.getCompletedTodos(db)).resolves.toEqual([]);
  });
});

describe('getCompletedTodos', () => {
  beforeEach(async () => {
    await todoRepo.insertTodo(
      db,
      todo({ title: 'Call the plumber', note: 'leaking tap', completedAt: '2026-08-20T10:00:00.000Z' }),
    );
    await todoRepo.insertTodo(
      db,
      todo({ title: 'File tax return', completedAt: '2026-08-22T16:00:00.000Z' }),
    );
    await todoRepo.insertTodo(db, todo({ title: 'Still open' }));
  });

  it('returns the most recently completed first', async () => {
    const completed = await todoRepo.getCompletedTodos(db);

    expect(completed.map((t) => t.title)).toEqual(['File tax return', 'Call the plumber']);
  });

  it('finds by title, case-insensitively', async () => {
    const found = await todoRepo.getCompletedTodos(db, { search: 'PLUMBER' });

    expect(found.map((t) => t.title)).toEqual(['Call the plumber']);
  });

  it('finds by note text too', async () => {
    const found = await todoRepo.getCompletedTodos(db, { search: 'leaking' });

    expect(found.map((t) => t.title)).toEqual(['Call the plumber']);
  });

  it('treats % and _ as literal characters, not wildcards', async () => {
    await expect(todoRepo.getCompletedTodos(db, { search: '%' })).resolves.toEqual([]);
    await expect(todoRepo.getCompletedTodos(db, { search: '_' })).resolves.toEqual([]);
  });

  it('filters to one completion day', async () => {
    const found = await todoRepo.getCompletedTodos(db, { date: '2026-08-22' });

    expect(found.map((t) => t.title)).toEqual(['File tax return']);
  });

  it('never returns an open todo', async () => {
    const found = await todoRepo.getCompletedTodos(db, { search: 'still' });

    expect(found).toEqual([]);
  });
});

describe('reorderTodos', () => {
  it('rewrites order within the ids given', async () => {
    const a = await todoRepo.createTodo(db, { title: 'A' });
    const b = await todoRepo.createTodo(db, { title: 'B' });
    const c = await todoRepo.createTodo(db, { title: 'C' });

    await todoRepo.reorderTodos(db, [c.id, a.id, b.id]);

    const open = await todoRepo.getOpenTodos(db);
    const bySort = [...open].sort((x, y) => x.sortOrder - y.sortOrder);
    expect(bySort.map((t) => t.title)).toEqual(['C', 'A', 'B']);
  });

  it('reuses the slots those ids already held, leaving other todos untouched', async () => {
    const a = await todoRepo.createTodo(db, { title: 'A' });
    const b = await todoRepo.createTodo(db, { title: 'B' });
    const outsider = await todoRepo.createTodo(db, { title: 'Outsider' });

    await todoRepo.reorderTodos(db, [b.id, a.id]);

    const after = await todoRepo.getOpenTodos(db);
    const sortOrders = after.map((t) => t.sortOrder).sort((x, y) => x - y);
    expect(sortOrders).toEqual([a.sortOrder, b.sortOrder, outsider.sortOrder]);
    expect(after.find((t) => t.id === outsider.id)?.sortOrder).toBe(outsider.sortOrder);
  });

  it('ignores ids that are not there', async () => {
    const a = await todoRepo.createTodo(db, { title: 'A' });

    await expect(todoRepo.reorderTodos(db, [uuid(), a.id])).resolves.toBeUndefined();
    await expect(todoRepo.getOpenTodos(db)).resolves.toHaveLength(1);
  });
});

describe('clearing history', () => {
  beforeEach(async () => {
    await todoRepo.insertTodo(db, todo({ title: 'Old', completedAt: '2026-06-01T10:00:00.000Z' }));
    await todoRepo.insertTodo(db, todo({ title: 'Recent', completedAt: '2026-08-22T10:00:00.000Z' }));
    await todoRepo.insertTodo(db, todo({ title: 'Open' }));
  });

  it('drops every completed todo but keeps the open ones', async () => {
    await todoRepo.deleteCompletedTodos(db);

    await expect(todoRepo.getCompletedTodos(db)).resolves.toEqual([]);
    await expect(todoRepo.getOpenTodos(db)).resolves.toHaveLength(1);
  });

  it('drops only history completed before the cutoff', async () => {
    await todoRepo.deleteCompletedTodosBeforeDate(db, '2026-08-01');

    const left = await todoRepo.getCompletedTodos(db);
    expect(left.map((t) => t.title)).toEqual(['Recent']);
  });

  it('keeps a todo completed exactly on the cutoff day', async () => {
    await todoRepo.deleteCompletedTodosBeforeDate(db, '2026-06-01');

    await expect(todoRepo.getCompletedTodos(db)).resolves.toHaveLength(2);
  });

  it('never removes an open todo, whatever the cutoff', async () => {
    await todoRepo.deleteCompletedTodosBeforeDate(db, '2030-01-01');

    await expect(todoRepo.getOpenTodos(db)).resolves.toHaveLength(1);
  });
});

describe('backup helpers', () => {
  it('round-trips every todo, open and completed', async () => {
    const open = todo({ title: 'Open one', dueDate: '2026-09-01' });
    const done = todo({ title: 'Done one', completedAt: '2026-08-21T08:00:00.000Z' });
    await todoRepo.insertTodo(db, open);
    await todoRepo.insertTodo(db, done);

    const all = await todoRepo.getAllTodos(db);

    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining([open, done]));
  });

  it('clears everything on import or wipe', async () => {
    await todoRepo.insertTodo(db, todo());
    await todoRepo.insertTodo(db, todo({ completedAt: '2026-08-21T08:00:00.000Z' }));

    await todoRepo.deleteAllTodos(db);

    await expect(todoRepo.getAllTodos(db)).resolves.toEqual([]);
  });

  it('refuses a duplicate id on import', async () => {
    const one = todo();
    await todoRepo.insertTodo(db, one);

    await expect(todoRepo.insertTodo(db, one)).rejects.toThrow();
  });
});
