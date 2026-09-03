import type { SQLiteDatabase } from 'expo-sqlite';
import {
  DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  DEFAULT_JOURNAL_NOTEBOOK_NAME,
  PROTOCOL_VERSION,
} from '../protocol';
import { newId } from '../utils/id';

/**
 * The repairs that a `CREATE TABLE IF NOT EXISTS` cannot express: columns added
 * after a table shipped, tables rebuilt into a new shape, seeds, and orphan
 * sweeps. `persistedConcepts.ts` hangs these off the concept they belong to.
 *
 * Deliberately kept as hand-written functions rather than squeezed into a
 * declarative format — a table rebuild has no shorter honest description.
 */

async function tableColumns(db: SQLiteDatabase, table: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => row.name));
}

/** Add any of `columns` the table is missing. A dev database created before a column existed keeps its old table. */
async function addMissingColumns(
  db: SQLiteDatabase,
  table: string,
  columns: Record<string, string>,
): Promise<void> {
  const existing = await tableColumns(db, table);
  for (const [name, type] of Object.entries(columns)) {
    if (existing.has(name)) continue;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}

/** Repairs DBs where schema_version advanced without `elements.archived_at`. */
export async function repairElements(db: SQLiteDatabase): Promise<void> {
  await addMissingColumns(db, 'elements', { archived_at: 'TEXT' });
}

export async function repairWeatherDaily(db: SQLiteDatabase): Promise<void> {
  await addMissingColumns(db, 'weather_daily', { precip_probability: 'INTEGER' });
}

/** Drop orphans left behind if foreign_keys were off during an older wipe. */
export async function repairDayNotes(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM day_notes WHERE element_id NOT IN (SELECT id FROM elements)');
}

/** Columns added to food_items after the table first shipped. */
const FOOD_ITEM_ADDED_COLUMNS: Record<string, string> = {
  diversity_key: 'TEXT',
  season_months_json: 'TEXT',
  peak_months_json: 'TEXT',
  glycemic_index: 'REAL',
  portions_json: 'TEXT',
};

export async function repairFoodItems(db: SQLiteDatabase): Promise<void> {
  await addMissingColumns(db, 'food_items', FOOD_ITEM_ADDED_COLUMNS);
}

/** Drop orphans left behind if foreign_keys were off during an older wipe. */
export async function repairFoodLog(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM food_log WHERE food_id NOT IN (SELECT id FROM food_items)');
}

async function seedDefaultJournalNotebook(db: SQLiteDatabase): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM journal_notebooks ORDER BY sort_order ASC, created_at ASC LIMIT 1',
  );
  if (existing) return existing.id;

  const id = newId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO journal_notebooks
      (id, name, color, icon, sort_order, created_at, protocol_version)
     VALUES (?, ?, ?, NULL, 0, ?, ?)`,
    id,
    DEFAULT_JOURNAL_NOTEBOOK_NAME,
    DEFAULT_JOURNAL_NOTEBOOK_COLOR,
    now,
    PROTOCOL_VERSION,
  );
  return id;
}

export async function repairJournalNotebooks(db: SQLiteDatabase): Promise<void> {
  await seedDefaultJournalNotebook(db);
}

/**
 * Both daily_journals table rebuilds, oldest first.
 *
 * Must run *before* the CREATE TABLE IF NOT EXISTS, which would otherwise see a
 * table and leave the old shape in place. A database old enough to need the
 * v16 rebuild needs the v22 one straight after it, so they are chained here
 * rather than left for two separate boots to notice.
 */
export async function rebuildDailyJournals(db: SQLiteDatabase): Promise<void> {
  await rebuildDailyJournalsToNotebooks(db);
  await rebuildDailyJournalsToChapters(db);
}

/** v16: pre-notebook daily_journals was UNIQUE(date) with no notebook_id. */
async function rebuildDailyJournalsToNotebooks(db: SQLiteDatabase): Promise<void> {
  const columns = await tableColumns(db, 'daily_journals');
  if (columns.size === 0 || columns.has('notebook_id')) return;

  const notebookId = await seedDefaultJournalNotebook(db);
  await db.execAsync(`
    CREATE TABLE daily_journals_v16 (
      id TEXT PRIMARY KEY NOT NULL,
      notebook_id TEXT NOT NULL,
      date TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      protocol_version INTEGER NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES journal_notebooks(id),
      UNIQUE (notebook_id, date)
    );
  `);
  await db.runAsync(
    `INSERT INTO daily_journals_v16
      (id, notebook_id, date, body, created_at, updated_at, protocol_version)
     SELECT id, ?, date, body, updated_at, updated_at, protocol_version
     FROM daily_journals`,
    notebookId,
  );
  await db.execAsync('DROP TABLE daily_journals');
  await db.execAsync('ALTER TABLE daily_journals_v16 RENAME TO daily_journals');
}

/**
 * v22: a notebook day holds several chapters.
 *
 * `UNIQUE (notebook_id, date)` is a table constraint, and SQLite cannot drop
 * one in place — so the table is rebuilt into the new shape, the same way v16
 * did it. Every existing row survives; each notebook day's rows are numbered
 * afterwards by `renumberJournalChapters`.
 */
async function rebuildDailyJournalsToChapters(db: SQLiteDatabase): Promise<void> {
  const columns = await tableColumns(db, 'daily_journals');
  if (columns.size === 0 || columns.has('sort_order')) return;

  await db.execAsync(`
    CREATE TABLE daily_journals_v22 (
      id TEXT PRIMARY KEY NOT NULL,
      notebook_id TEXT NOT NULL,
      date TEXT NOT NULL,
      body TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      protocol_version INTEGER NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES journal_notebooks(id)
    );
  `);
  await db.execAsync(`
    INSERT INTO daily_journals_v22
      (id, notebook_id, date, body, sort_order, created_at, updated_at, protocol_version)
    SELECT id, notebook_id, date, body, 0, created_at, updated_at, protocol_version
    FROM daily_journals;
  `);
  await db.execAsync('DROP TABLE daily_journals');
  await db.execAsync('ALTER TABLE daily_journals_v22 RENAME TO daily_journals');
}

/**
 * Chapters, not one document per day.
 *
 * The inverse of what this did up to v21, and the inversion is the whole point:
 * it used to join a day's rows into one body and delete the rest. Two rows for
 * one notebook day are now the ordinary shape of a day someone wrote in twice,
 * and nothing in the data distinguishes that from an old duplicate — so no row
 * is ever merged away here. Whitespace-only rows still go: they carry no text
 * to lose, and they used to light the Home note icon for an empty day (v18).
 */
export async function repairDailyJournals(db: SQLiteDatabase): Promise<void> {
  const columns = await tableColumns(db, 'daily_journals');
  if (!columns.has('notebook_id') || !columns.has('sort_order')) return;

  await db.runAsync(`DELETE FROM daily_journals WHERE trim(body) = ''`);
  // The v17..v21 unique index is the one thing that would still refuse a second
  // chapter, and a rebuilt table can carry it no longer — but a database that
  // reached the new column shape by other means might.
  await db.execAsync('DROP INDEX IF EXISTS idx_daily_journals_notebook_date');
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_daily_journals_notebook_chapter ON daily_journals(notebook_id, date, sort_order)',
  );
  await renumberJournalChapters(db);
}

/**
 * Number every notebook day's chapters 0..n-1.
 *
 * Ordered by `(sort_order, created_at, updated_at, id)` — a total order, so
 * running this twice is a no-op and the repair pass stays idempotent.
 */
async function renumberJournalChapters(db: SQLiteDatabase): Promise<void> {
  const groups = await db.getAllAsync<{ notebook_id: string; date: string }>(
    `SELECT notebook_id, date FROM daily_journals
     GROUP BY notebook_id, date HAVING COUNT(*) > 1 OR MIN(sort_order) <> 0`,
  );
  for (const group of groups) {
    const rows = await db.getAllAsync<{ id: string; sort_order: number }>(
      `SELECT id, sort_order FROM daily_journals
       WHERE notebook_id = ? AND date = ?
       ORDER BY sort_order ASC, created_at ASC, updated_at ASC, id ASC`,
      group.notebook_id,
      group.date,
    );
    for (const [index, row] of rows.entries()) {
      if (row.sort_order === index) continue;
      await db.runAsync('UPDATE daily_journals SET sort_order = ? WHERE id = ?', index, row.id);
    }
  }
}

/**
 * Rebuild pre-v16 note_share_state, which had no entry_id. Must run before the
 * CREATE TABLE IF NOT EXISTS for the same reason as daily_journals.
 *
 * Backfills entry_id from the (then-single) daily_journals row per date.
 * Superseded by v17: runtime code now stores the notebook id in entry_id
 * (see noteSave.ts shareTarget), not a daily_journals row id. Harmless —
 * this is a local cache table, not backed up — but don't read this
 * migration as documentation of the current entry_id meaning.
 */
export async function rebuildNoteShareState(db: SQLiteDatabase): Promise<void> {
  const columns = await tableColumns(db, 'note_share_state');
  if (columns.size === 0 || columns.has('entry_id')) return;

  await db.execAsync(`
    CREATE TABLE note_share_state_v16 (
      kind TEXT NOT NULL,
      element_id TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      date TEXT NOT NULL,
      body_fp TEXT NOT NULL,
      shared_at TEXT NOT NULL,
      PRIMARY KEY (kind, element_id, entry_id, date)
    );
  `);
  await db.execAsync(`
    INSERT INTO note_share_state_v16
      (kind, element_id, entry_id, date, body_fp, shared_at)
    SELECT
      s.kind,
      s.element_id,
      CASE
        WHEN s.kind = 'journal' THEN COALESCE(
          (SELECT j.id FROM daily_journals j WHERE j.date = s.date LIMIT 1),
          ''
        )
        ELSE ''
      END,
      s.date,
      s.body_fp,
      s.shared_at
    FROM note_share_state s;
  `);
  await db.execAsync(`
    DROP TABLE note_share_state;
    ALTER TABLE note_share_state_v16 RENAME TO note_share_state;
  `);
}
