/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../src/db/client';
import {
  bumpAllDataGenerations,
  bumpDataGeneration,
  getDataGeneration,
  resetDataGenerationsForTests,
  withGuardedWrite,
} from '../src/db/dataGeneration';
import { withDbWriteLock } from '../src/db/writeLock';
import { ensureTodoSchema } from '../src/db/schemaIntegrity';
import * as todoRepo from '../src/db/repositories/todoRepository';
import { useTodoStore } from '../src/store/todoStore';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

/** Real SQL against real SQLite — a mock cannot show that no row landed. */
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
    getFirstAsync: async (sql: string, ...params: Bind[]) =>
      raw.prepare(sql).get(...params) ?? null,
  } as unknown as SQLiteDatabase;
}

/** A promise plus its resolver, so a test can hold a write mid-flight. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  resetDataGenerationsForTests();
});

describe('bumpDataGeneration', () => {
  it('counts each scope separately', () => {
    bumpDataGeneration('todos');
    bumpDataGeneration('todos');
    bumpDataGeneration('calendar');

    expect(getDataGeneration('todos')).toBe(2);
    expect(getDataGeneration('calendar')).toBe(1);
    expect(getDataGeneration('weather')).toBe(0);
  });

  it('bumps every scope for a full replace', () => {
    bumpAllDataGenerations();

    for (const scope of ['protocol', 'calendar', 'weather', 'catalog', 'todos', 'journal'] as const) {
      expect(getDataGeneration(scope)).toBe(1);
    }
  });
});

describe('withGuardedWrite', () => {
  it('discards a write whose scope was replaced mid-flight', async () => {
    const gate = deferred();
    const committed: string[] = [];

    const write = withGuardedWrite('todos', async ({ superseded }) => {
      await gate.promise;
      if (superseded()) return undefined;
      committed.push('landed');
      return 'landed';
    });

    bumpDataGeneration('todos');
    gate.resolve();

    await expect(write).resolves.toBeUndefined();
    expect(committed).toEqual([]);
  });

  it('commits when a different scope is replaced', async () => {
    const gate = deferred();

    const write = withGuardedWrite('todos', async ({ superseded }) => {
      await gate.promise;
      if (superseded()) return undefined;
      return 'landed';
    });

    // A calendar-only clear must not throw away an unrelated todo write.
    bumpDataGeneration('calendar');
    gate.resolve();

    await expect(write).resolves.toBe('landed');
  });

  it('never runs the body when the bump happened while queued for the lock', async () => {
    const clear = deferred();
    let bodyRan = false;

    const holdingLock = withDbWriteLock(async () => {
      bumpDataGeneration('todos');
      await clear.promise;
    });
    const write = withGuardedWrite('todos', async () => {
      bodyRan = true;
      return 'landed';
    });

    clear.resolve();
    await holdingLock;

    await expect(write).resolves.toBeUndefined();
    expect(bodyRan).toBe(false);
  });

  it('serialises against withDbWriteLock', async () => {
    const order: string[] = [];
    const gate = deferred();

    const first = withDbWriteLock(async () => {
      order.push('lock:start');
      await gate.promise;
      order.push('lock:end');
    });
    const second = withGuardedWrite('todos', async () => {
      order.push('guarded');
    });

    gate.resolve();
    await Promise.all([first, second]);

    expect(order).toEqual(['lock:start', 'lock:end', 'guarded']);
  });

  it('releases the lock when the body throws', async () => {
    const failing = withGuardedWrite('todos', async () => {
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');

    await expect(withGuardedWrite('todos', async () => 'ok')).resolves.toBe('ok');
  });
});

describe('todoStore end to end', () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = createTestDb();
    await ensureTodoSchema(db);
    (getDatabase as jest.Mock).mockResolvedValue(db);
    useTodoStore.setState({ todos: [], loaded: false, loading: false, error: null });
  });

  it('writes a todo when nothing replaced the dataset', async () => {
    await useTodoStore.getState().create({ title: 'Buy milk' });

    await expect(todoRepo.getOpenTodos(db)).resolves.toHaveLength(1);
    expect(useTodoStore.getState().todos).toHaveLength(1);
  });

  it('drops an in-flight create when the todo scope is wiped', async () => {
    // Stand in for a clear/import: hold the write lock, bump, then release —
    // exactly what clearAppData does around its transaction.
    const clearDone = deferred();
    const clearing = withDbWriteLock(async () => {
      bumpDataGeneration('todos');
      await clearDone.promise;
    });

    const creating = useTodoStore.getState().create({ title: 'Buy milk' });
    clearDone.resolve();
    await clearing;

    await expect(creating).resolves.toBeUndefined();
    await expect(todoRepo.getOpenTodos(db)).resolves.toEqual([]);
    expect(useTodoStore.getState().todos).toEqual([]);
  });

  it('keeps an in-flight todo write when only the calendar is cleared', async () => {
    const clearDone = deferred();
    const clearing = withDbWriteLock(async () => {
      bumpDataGeneration('calendar');
      await clearDone.promise;
    });

    const creating = useTodoStore.getState().create({ title: 'Buy milk' });
    clearDone.resolve();
    await clearing;

    await expect(creating).resolves.toMatchObject({ title: 'Buy milk' });
    await expect(todoRepo.getOpenTodos(db)).resolves.toHaveLength(1);
  });
});
