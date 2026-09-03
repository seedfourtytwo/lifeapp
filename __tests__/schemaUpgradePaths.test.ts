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

function indexNames(raw: DatabaseSync, table: string) {
  return (raw.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=? ORDER BY name").all(table) as {name:string}[]).map(r=>r.name);
}

it.each([1, 7, 12, 15, 18, 20, 21])('upgrades a v%i database', async (from) => {
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(from);
  raw.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  await runMigrations(db);
  const v = raw.prepare('SELECT version FROM schema_version').get() as {version:number};
  expect(v.version).toBe(22);
  expect(tables(raw)).toEqual([
    'app_settings','calendar_events','calendar_occurrence_clears','calendar_reminders','calendars',
    'daily_journals','dashboard_items','day_notes','elements','events','food_items','food_log',
    'journal_notebooks','note_share_state','schema_version','todos','weather_daily',
  ]);
  // v22 traded the one-document-per-day constraint for a chapter ordering column.
  // The old unique index must be gone — left behind it would reject a second chapter.
  const indexes = indexNames(raw, 'daily_journals');
  expect(indexes).not.toContain('idx_daily_journals_notebook_date');
  expect(indexes).toContain('idx_daily_journals_notebook_chapter');
  const columns = (raw.prepare('PRAGMA table_info(daily_journals)').all() as {name:string}[]).map(r=>r.name);
  expect(columns).toContain('sort_order');
  raw.close();
});

it('lets a notebook day hold two chapters once upgraded', async () => {
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(20);
  raw.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  await runMigrations(db);

  const notebook = raw.prepare('SELECT id FROM journal_notebooks LIMIT 1').get() as {id:string};
  const insert = raw.prepare(
    `INSERT INTO daily_journals (id, notebook_id, date, body, sort_order, created_at, updated_at, protocol_version)
     VALUES (?,?,?,?,?,?,?,1)`,
  );
  insert.run('00000000-0000-4000-8000-00000000000a', notebook.id, '2025-03-01', 'Morning', 0, '2025-03-01T08:00:00.000Z', '2025-03-01T08:00:00.000Z');
  insert.run('00000000-0000-4000-8000-00000000000b', notebook.id, '2025-03-01', 'Evening', 1, '2025-03-01T21:00:00.000Z', '2025-03-01T21:00:00.000Z');

  const rows = raw.prepare('SELECT body FROM daily_journals ORDER BY sort_order').all() as {body:string}[];
  expect(rows.map((r) => r.body)).toEqual(['Morning', 'Evening']);
  raw.close();
});

/**
 * The one place the old rule could still eat text.
 *
 * A pre-v22 device with two rows for one notebook day is by definition one
 * where the unique index was missing — that is how it got two. The upgrade
 * must carry both across rather than joining them: keeping a stray duplicate
 * is a delete away, and a merge cannot be undone.
 */
it('keeps both rows when a pre-v22 database already had two for one day', async () => {
  const raw = new DatabaseSync(':memory:');
  const db = wrap(raw);
  raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(21);
  raw.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  raw.exec(`CREATE TABLE journal_notebooks (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, icon TEXT,
    sort_order INTEGER NOT NULL, created_at TEXT NOT NULL, protocol_version INTEGER NOT NULL)`);
  raw.prepare('INSERT INTO journal_notebooks VALUES (?,?,?,NULL,?,?,?)')
    .run('00000000-0000-4000-8000-000000000001', 'Journal', '#64748B', 0, '2025-01-01T00:00:00.000Z', 1);
  // The v16..v21 column shape, minus the constraint that should have stopped this.
  raw.exec(`CREATE TABLE daily_journals (
    id TEXT PRIMARY KEY NOT NULL, notebook_id TEXT NOT NULL, date TEXT NOT NULL, body TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, protocol_version INTEGER NOT NULL)`);
  const insert = raw.prepare('INSERT INTO daily_journals VALUES (?,?,?,?,?,?,1)');
  insert.run('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','2025-02-01','Second half','2025-02-01T20:00:00.000Z','2025-02-01T20:00:00.000Z');
  insert.run('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','2025-02-01','First half','2025-02-01T07:00:00.000Z','2025-02-01T07:00:00.000Z');

  await runMigrations(db);

  const rows = raw.prepare('SELECT body, sort_order FROM daily_journals ORDER BY sort_order').all() as {body:string;sort_order:number}[];
  expect(rows).toEqual([
    { body: 'First half', sort_order: 0 },
    { body: 'Second half', sort_order: 1 },
  ]);
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
