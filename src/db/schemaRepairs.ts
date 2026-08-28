import type { SQLiteDatabase } from 'expo-sqlite';
import {
  DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  DEFAULT_JOURNAL_NOTEBOOK_NAME,
  joinJournalDayBodies,
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
 * Rebuild pre-v16 daily_journals, which was UNIQUE(date) with no notebook_id.
 * Must run *before* the CREATE TABLE IF NOT EXISTS, which would otherwise see a
 * table and leave the old shape in place.
 */
export async function rebuildDailyJournals(db: SQLiteDatabase): Promise<void> {
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

/** One document per notebook per day: merge same-day fragments, drop empties, enforce it. */
export async function repairDailyJournals(db: SQLiteDatabase): Promise<void> {
  const columns = await tableColumns(db, 'daily_journals');
  if (!columns.has('notebook_id')) return;

  await mergeDuplicateJournalDays(db);
  await db.runAsync(`DELETE FROM daily_journals WHERE trim(body) = ''`);
  await db.execAsync('DROP INDEX IF EXISTS idx_daily_journals_notebook_date');
  await db.execAsync(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_journals_notebook_date ON daily_journals(notebook_id, date)',
  );
}

async function mergeDuplicateJournalDays(db: SQLiteDatabase): Promise<void> {
  const groups = await db.getAllAsync<{ notebook_id: string; date: string }>(
    `SELECT notebook_id, date FROM daily_journals
     GROUP BY notebook_id, date HAVING COUNT(*) > 1`,
  );
  for (const group of groups) {
    const rows = await db.getAllAsync<{
      id: string;
      body: string;
      updated_at: string;
    }>(
      `SELECT id, body, updated_at FROM daily_journals
       WHERE notebook_id = ? AND date = ?
       ORDER BY created_at ASC, updated_at ASC`,
      group.notebook_id,
      group.date,
    );
    if (rows.length < 2) continue;
    const keep = rows[0];
    if (!keep) continue;
    const body = joinJournalDayBodies(rows.map((row) => row.body));
    if (!body.trim()) {
      for (const row of rows) {
        await db.runAsync('DELETE FROM daily_journals WHERE id = ?', row.id);
      }
      continue;
    }
    const last = rows[rows.length - 1];
    await db.runAsync(
      'UPDATE daily_journals SET body = ?, updated_at = ? WHERE id = ?',
      body,
      last?.updated_at ?? keep.updated_at,
      keep.id,
    );
    for (const extra of rows.slice(1)) {
      await db.runAsync('DELETE FROM daily_journals WHERE id = ?', extra.id);
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
