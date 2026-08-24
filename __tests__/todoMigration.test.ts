import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../src/db/migrations';
import * as todoRepo from '../src/db/repositories/todoRepository';

type Bind = null | number | string;

function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  } as unknown as SQLiteDatabase;
}

function tables(raw: DatabaseSync): Set<string> {
  return new Set(
    (raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[]).map((row) => row.name),
  );
}

let raw: DatabaseSync;
let db: SQLiteDatabase;

beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  db = wrap(raw);
});

describe('todos schema (v21)', () => {
  it('creates the table on a fresh install', async () => {
    await runMigrations(db);

    expect(tables(raw).has('todos')).toBe(true);
  });

  it('adds the table to a database that stopped at v20', async () => {
    // A v20 device has every earlier table but has never seen todos.
    raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
    raw.exec('INSERT INTO schema_version (version) VALUES (20)');
    raw.exec('DROP TABLE IF EXISTS todos');

    await runMigrations(db);

    expect(tables(raw).has('todos')).toBe(true);
    const version = raw.prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(version.version).toBe(21);
  });

  it('keeps todos written before an upgrade', async () => {
    await runMigrations(db);
    const created = await todoRepo.createTodo(db, { title: 'Survive the upgrade' });

    await runMigrations(db);

    await expect(todoRepo.getTodo(db, created.id)).resolves.toEqual(created);
  });

  it('is idempotent across repeated boots', async () => {
    await runMigrations(db);
    await runMigrations(db);
    await runMigrations(db);

    const version = raw.prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(version.version).toBe(21);
    await expect(todoRepo.getAllTodos(db)).resolves.toEqual([]);
  });
});
