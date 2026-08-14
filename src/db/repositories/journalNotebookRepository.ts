import type { SQLiteDatabase } from 'expo-sqlite';
import type { JournalNotebook, TrackerIconId } from '../../protocol';
import {
  DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  DEFAULT_JOURNAL_NOTEBOOK_NAME,
  JournalNotebookSchema,
  PROTOCOL_VERSION,
  isJournalNotebookColor,
  isTrackerIconId,
} from '../../protocol';
import { newId } from '../../utils/id';

interface JournalNotebookRow {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
  protocol_version: number;
}

function rowToNotebook(row: JournalNotebookRow): JournalNotebook {
  return JournalNotebookSchema.parse({
    id: row.id,
    name: row.name,
    color: isJournalNotebookColor(row.color) ? row.color : DEFAULT_JOURNAL_NOTEBOOK_COLOR,
    icon: row.icon && isTrackerIconId(row.icon) ? row.icon : undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    protocolVersion: PROTOCOL_VERSION,
  });
}

function tryRowToNotebook(row: JournalNotebookRow): JournalNotebook | null {
  try {
    return rowToNotebook(row);
  } catch {
    return null;
  }
}

export async function getAllNotebooks(db: SQLiteDatabase): Promise<JournalNotebook[]> {
  await ensureDefaultNotebook(db);
  const rows = await db.getAllAsync<JournalNotebookRow>(
    'SELECT * FROM journal_notebooks ORDER BY sort_order ASC, created_at ASC',
  );
  const notebooks: JournalNotebook[] = [];
  for (const row of rows) {
    const notebook = tryRowToNotebook(row);
    if (notebook) notebooks.push(notebook);
  }
  return notebooks;
}

export async function getNotebook(
  db: SQLiteDatabase,
  id: string,
): Promise<JournalNotebook | null> {
  const row = await db.getFirstAsync<JournalNotebookRow>(
    'SELECT * FROM journal_notebooks WHERE id = ?',
    id,
  );
  return row ? tryRowToNotebook(row) : null;
}

export async function ensureDefaultNotebook(db: SQLiteDatabase): Promise<JournalNotebook> {
  const row = await db.getFirstAsync<JournalNotebookRow>(
    'SELECT * FROM journal_notebooks ORDER BY sort_order ASC, created_at ASC LIMIT 1',
  );
  if (row) {
    const existing = tryRowToNotebook(row);
    if (existing) return existing;
  }

  const notebook = JournalNotebookSchema.parse({
    id: newId(),
    name: DEFAULT_JOURNAL_NOTEBOOK_NAME,
    color: DEFAULT_JOURNAL_NOTEBOOK_COLOR,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
  });
  await insertNotebook(db, notebook);
  return notebook;
}

export async function insertNotebook(
  db: SQLiteDatabase,
  notebook: JournalNotebook,
): Promise<void> {
  const parsed = JournalNotebookSchema.parse(notebook);
  await db.runAsync(
    `INSERT INTO journal_notebooks
      (id, name, color, icon, sort_order, created_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.name,
    parsed.color,
    parsed.icon ?? null,
    parsed.sortOrder,
    parsed.createdAt,
    parsed.protocolVersion,
  );
}

export async function updateNotebook(
  db: SQLiteDatabase,
  id: string,
  patch: { name: string; color: string; icon?: TrackerIconId },
): Promise<JournalNotebook | null> {
  const existing = await getNotebook(db, id);
  if (!existing) return null;
  const parsed = JournalNotebookSchema.parse({
    ...existing,
    name: patch.name,
    color: patch.color,
    icon: patch.icon,
  });
  await db.runAsync(
    `UPDATE journal_notebooks
     SET name = ?, color = ?, icon = ?
     WHERE id = ?`,
    parsed.name,
    parsed.color,
    parsed.icon ?? null,
    id,
  );
  return getNotebook(db, id);
}

export async function deleteNotebook(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM journal_notebooks WHERE id = ?', id);
}

export async function nextSortOrder(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM journal_notebooks',
  );
  return (row?.m ?? -1) + 1;
}

export async function setSortOrder(
  db: SQLiteDatabase,
  id: string,
  sortOrder: number,
): Promise<void> {
  await db.runAsync('UPDATE journal_notebooks SET sort_order = ? WHERE id = ?', sortOrder, id);
}
