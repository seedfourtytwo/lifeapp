import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../../src/db/migrations';

type Bind = null | number | string;

export interface TestDb {
  /** The node:sqlite handle, for seeding rows the app could never write and for reading back. */
  raw: DatabaseSync;
  /** The same database behind the slice of the expo-sqlite API the app uses. */
  db: SQLiteDatabase;
}

/**
 * A real in-memory SQLite at the current schema. Transactions are real too:
 * `withTransactionAsync` commits or rolls back, so a test can see a write that
 * failed half way leave nothing behind.
 */
export async function createMigratedTestDb(): Promise<TestDb> {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  const db = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: Bind[]) =>
      raw.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
  await runMigrations(db);
  return { raw, db };
}
