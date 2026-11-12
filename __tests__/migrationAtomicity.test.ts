import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../src/db/migrations';
import * as schemaIntegrity from '../src/db/schemaIntegrity';

/**
 * A migration that dies half way must leave the database exactly as it was —
 * schema and `schema_version` both — so the next start simply runs it again.
 * Without a transaction around each step, a crash between the step and its
 * version bump re-runs a half-applied step on a changed schema, or skips it.
 */

type Bind = null | number | string;
function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => { raw.exec(sql); },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
  } as unknown as SQLiteDatabase;
}

function version(raw: DatabaseSync): number {
  return (raw.prepare('SELECT version FROM schema_version').get() as { version: number }).version;
}

function hasTable(raw: DatabaseSync, name: string): boolean {
  return raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name) !== undefined;
}

function dbAtVersion(from: number): DatabaseSync {
  const raw = new DatabaseSync(':memory:');
  raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(from);
  raw.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  return raw;
}

afterEach(() => {
  jest.restoreAllMocks();
});

it('rolls back a step that throws half way and runs it again on the next start', async () => {
  const raw = dbAtVersion(19);
  const db = wrap(raw);
  const failing = jest
    .spyOn(schemaIntegrity, 'ensureTodoSchema')
    .mockImplementationOnce(async (target) => {
      await target.execAsync('CREATE TABLE half_made (id TEXT)');
      await target.runAsync("INSERT INTO app_settings (key, value) VALUES ('half', 'done')");
      throw new Error('killed mid-step');
    });

  await expect(runMigrations(db)).rejects.toThrow('killed mid-step');

  expect(failing).toHaveBeenCalledTimes(1);
  // Step 20 committed; step 21 left nothing behind, and its version bump never landed.
  expect(version(raw)).toBe(20);
  expect(hasTable(raw, 'half_made')).toBe(false);
  expect(raw.prepare("SELECT value FROM app_settings WHERE key='half'").get()).toBeUndefined();

  await runMigrations(db);
  expect(version(raw)).toBe(24);
  raw.close();
});

it('rolls back a failed repair pass with the last step, so the next start repairs again', async () => {
  const raw = dbAtVersion(23);
  const db = wrap(raw);
  jest.spyOn(schemaIntegrity, 'ensureSchemaIntegrity').mockRejectedValueOnce(new Error('repair died'));

  await expect(runMigrations(db)).rejects.toThrow('repair died');
  expect(version(raw)).toBe(23);

  await runMigrations(db);
  expect(version(raw)).toBe(24);
  raw.close();
});

it('does not trip over a temp table left behind by a crashed rebuild', async () => {
  const raw = dbAtVersion(21);
  const db = wrap(raw);
  raw.exec(`CREATE TABLE journal_notebooks (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, icon TEXT,
    sort_order INTEGER NOT NULL, created_at TEXT NOT NULL, protocol_version INTEGER NOT NULL)`);
  raw.prepare('INSERT INTO journal_notebooks VALUES (?,?,?,NULL,?,?,?)')
    .run('00000000-0000-4000-8000-000000000001', 'Journal', '#64748B', 0, '2025-01-01T00:00:00.000Z', 1);
  raw.exec(`CREATE TABLE daily_journals (
    id TEXT PRIMARY KEY NOT NULL, notebook_id TEXT NOT NULL, date TEXT NOT NULL, body TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, protocol_version INTEGER NOT NULL,
    UNIQUE (notebook_id, date))`);
  raw.prepare('INSERT INTO daily_journals VALUES (?,?,?,?,?,?,1)').run(
    '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001',
    '2025-02-01', 'Kept', '2025-02-01T20:00:00.000Z', '2025-02-01T20:00:00.000Z',
  );
  // A previous run created the temp table, copied half the rows, then died.
  raw.exec('CREATE TABLE daily_journals_v22 (id TEXT PRIMARY KEY NOT NULL, stale TEXT)');
  raw.exec("INSERT INTO daily_journals_v22 VALUES ('00000000-0000-4000-8000-000000000011', 'x')");

  await runMigrations(db);

  expect(version(raw)).toBe(24);
  expect(hasTable(raw, 'daily_journals_v22')).toBe(false);
  expect(raw.prepare('SELECT body, sort_order FROM daily_journals').all()).toEqual([
    { body: 'Kept', sort_order: 0 },
  ]);
  raw.close();
});
