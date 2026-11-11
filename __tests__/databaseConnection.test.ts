/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../src/db/safetyCopy', () => ({
  takeSafetyCopy: jest.fn(async () => undefined),
}));

import * as SQLite from 'expo-sqlite';
import { getDatabase, invalidateDatabaseConnection } from '../src/db/client';

type Bind = null | number | string;

function wrap(raw: DatabaseSync, executed: string[]): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      executed.push(sql);
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
  } as unknown as SQLiteDatabase;
}

describe('the app database connection', () => {
  let raw: DatabaseSync;
  let executed: string[];

  beforeEach(() => {
    invalidateDatabaseConnection();
    raw = new DatabaseSync(':memory:');
    executed = [];
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(wrap(raw, executed));
  });

  afterEach(() => raw.close());

  it('waits for a lock held elsewhere instead of failing at once', async () => {
    await getDatabase();

    const row = raw.prepare('PRAGMA busy_timeout').get() as { timeout: number };
    expect(row.timeout).toBe(5000);
  });

  it('sets the wait before the migrations take their first write lock', async () => {
    await getDatabase();

    expect(executed[0]).toMatch(/PRAGMA busy_timeout = 5000/);
  });
});
