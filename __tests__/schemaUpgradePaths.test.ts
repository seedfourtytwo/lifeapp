import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../src/db/migrations';

/**
 * The numbered ladder end to end: a database left on any shipped version must
 * reach the current schema. Pinned here because the repair pass those migrations
 * lean on is now derived from `PERSISTED_CONCEPTS` — the ladder itself is frozen,
 * so these are the paths that must keep working unchanged.
 */

type Bind = null | number | string;
function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => { raw.exec(sql); },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => { await fn(); },
  } as unknown as SQLiteDatabase;
}
function tables(raw: DatabaseSync) {
  return (raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[]).map(r=>r.name);
}

it.each([1, 7, 12, 15, 18, 20])('upgrades a v%i database', async (from) => {
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(from);
  raw.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  await runMigrations(db);
  const v = raw.prepare('SELECT version FROM schema_version').get() as {version:number};
  expect(v.version).toBe(21);
  expect(tables(raw)).toEqual([
    'app_settings','calendar_events','calendar_occurrence_clears','calendar_reminders','calendars',
    'daily_journals','dashboard_items','day_notes','elements','events','food_items','food_log',
    'journal_notebooks','note_share_state','schema_version','todos','weather_daily',
  ]);
  // The pre-v16 journal rebuild path is the fiddly one: prove the unique index landed.
  const idx = raw.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_daily_journals_notebook_date'").all();
  expect(idx).toHaveLength(1);
  raw.close();
});

it('rebuilds a pre-v16 daily_journals table', async () => {
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(15);
  raw.exec(`CREATE TABLE daily_journals (
    id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL UNIQUE, body TEXT NOT NULL,
    updated_at TEXT NOT NULL, protocol_version INTEGER NOT NULL)`);
  raw.prepare('INSERT INTO daily_journals VALUES (?,?,?,?,?)')
    .run('00000000-0000-4000-8000-000000000001','2025-01-01','Old entry','2025-01-01T00:00:00.000Z',1);
  raw.exec(`CREATE TABLE note_share_state (kind TEXT NOT NULL, element_id TEXT NOT NULL,
    date TEXT NOT NULL, body_fp TEXT NOT NULL, shared_at TEXT NOT NULL,
    PRIMARY KEY (kind, element_id, date))`);
  raw.prepare('INSERT INTO note_share_state VALUES (?,?,?,?,?)')
    .run('journal','','2025-01-01','fp','2025-01-01T00:00:00.000Z');

  await runMigrations(db);

  const rows = raw.prepare('SELECT id, notebook_id, body FROM daily_journals').all() as {notebook_id:string;body:string}[];
  expect(rows).toHaveLength(1);
  expect(rows[0]!.body).toBe('Old entry');
  expect(rows[0]!.notebook_id).toEqual(expect.any(String));
  const share = raw.prepare('SELECT entry_id FROM note_share_state').all() as {entry_id:string}[];
  expect(share).toHaveLength(1);
  raw.close();
});
