/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../src/db/client';
import { resetDataGenerationsForTests } from '../src/db/dataGeneration';
import { ensureTodoSchema } from '../src/db/schemaIntegrity';
import * as todoRepo from '../src/db/repositories/todoRepository';
import { useTodoStore } from '../src/store/todoStore';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

/** Real SQL against real SQLite — the "today" filter is SQL, so a mock proves nothing. */
function createTestDb(): SQLiteDatabase {
  const raw = new DatabaseSync(':memory:');
  type Bind = null | number | string;

  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: Bind[]) =>
      raw.prepare(sql).get(...params) ?? null,
  } as unknown as SQLiteDatabase;
}

/** A moment on the local day `daysAgo` days back, `minute` minutes past noon. */
function localNoon(daysAgo: number, minute = 0): string {
  const at = new Date();
  at.setDate(at.getDate() - daysAgo);
  at.setHours(12, minute, 0, 0);
  return at.toISOString();
}

describe('todoStore: todos ticked today', () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    resetDataGenerationsForTests();
    db = createTestDb();
    await ensureTodoSchema(db);
    (getDatabase as jest.Mock).mockResolvedValue(db);
    useTodoStore.setState({
      todos: [],
      doneToday: [],
      loaded: false,
      loading: false,
      error: null,
    });
  });

  it('starts with none', async () => {
    await todoRepo.createTodo(db, { title: 'Open' });

    await useTodoStore.getState().reload();

    expect(useTodoStore.getState().doneToday).toEqual([]);
  });

  it('holds what was ticked today, oldest tick first, and nothing older', async () => {
    const second = await todoRepo.createTodo(db, { title: 'Ticked second' });
    const first = await todoRepo.createTodo(db, { title: 'Ticked first' });
    const yesterday = await todoRepo.createTodo(db, { title: 'Ticked yesterday' });
    await todoRepo.createTodo(db, { title: 'Still open' });
    await todoRepo.setTodoCompleted(db, second.id, localNoon(0, 2));
    await todoRepo.setTodoCompleted(db, first.id, localNoon(0, 1));
    await todoRepo.setTodoCompleted(db, yesterday.id, localNoon(1));

    await useTodoStore.getState().reload();

    const state = useTodoStore.getState();
    expect(state.doneToday.map((todo) => todo.title)).toEqual(['Ticked first', 'Ticked second']);
    expect(state.todos.map((todo) => todo.title)).toEqual(['Still open']);
  });

  it('moves a todo across on a tick and back when it is reopened', async () => {
    const created = await useTodoStore.getState().create({ title: 'Buy milk' });
    const id = created!.id;

    await useTodoStore.getState().setCompleted(id, true);
    expect(useTodoStore.getState().todos).toEqual([]);
    expect(useTodoStore.getState().doneToday.map((todo) => todo.id)).toEqual([id]);

    await useTodoStore.getState().setCompleted(id, false);
    expect(useTodoStore.getState().todos.map((todo) => todo.id)).toEqual([id]);
    expect(useTodoStore.getState().doneToday).toEqual([]);
  });
});
