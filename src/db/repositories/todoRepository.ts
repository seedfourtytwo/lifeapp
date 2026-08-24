import type { SQLiteDatabase } from 'expo-sqlite';
import {
  PROTOCOL_VERSION,
  TodoSchema,
  nextTodoSortOrder,
  type Todo,
} from '../../protocol';
import { newId } from '../../utils/id';

interface TodoRow {
  id: string;
  title: string;
  note: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
  protocol_version: number;
}

function rowToTodo(row: TodoRow): Todo {
  return TodoSchema.parse({
    id: row.id,
    title: row.title,
    note: row.note,
    dueDate: row.due_date,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    protocolVersion: PROTOCOL_VERSION,
  });
}

/** A row written by an older or corrupted build must not break the whole list. */
function collect(rows: TodoRow[]): Todo[] {
  const todos: Todo[] = [];
  for (const row of rows) {
    try {
      todos.push(rowToTodo(row));
    } catch {
      // Skip unreadable rows rather than blanking the screen.
    }
  }
  return todos;
}

/** Everything, open and done — for backup export. */
export async function getAllTodos(db: SQLiteDatabase): Promise<Todo[]> {
  const rows = await db.getAllAsync<TodoRow>('SELECT * FROM todos ORDER BY sort_order ASC');
  return collect(rows);
}

/** The working list. Section order is decided in the protocol, not in SQL. */
export async function getOpenTodos(db: SQLiteDatabase): Promise<Todo[]> {
  const rows = await db.getAllAsync<TodoRow>(
    'SELECT * FROM todos WHERE completed_at IS NULL ORDER BY sort_order ASC',
  );
  return collect(rows);
}

export interface CompletedTodoQuery {
  /** Matched against title and note, case-insensitively. */
  search?: string;
  /** Local completion day, `YYYY-MM-DD`. */
  date?: string;
  limit?: number;
}

/** LIKE treats these as wildcards, so a search for "%" must not match everything. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * History: completed todos, newest first. `date` filters on the local calendar
 * day of `completed_at`, which is stored as UTC — `localtime` converts it back
 * so a todo ticked at 1am is filed under the day it felt like.
 */
export async function getCompletedTodos(
  db: SQLiteDatabase,
  query: CompletedTodoQuery = {},
): Promise<Todo[]> {
  const where = ['completed_at IS NOT NULL'];
  const params: (string | number)[] = [];

  const search = query.search?.trim();
  if (search) {
    where.push("(title LIKE ? ESCAPE '\\' OR IFNULL(note, '') LIKE ? ESCAPE '\\')");
    const pattern = `%${escapeLike(search)}%`;
    params.push(pattern, pattern);
  }

  if (query.date) {
    where.push("date(completed_at, 'localtime') = ?");
    params.push(query.date);
  }

  const limit = query.limit == null ? '' : ' LIMIT ?';
  if (query.limit != null) params.push(query.limit);

  const rows = await db.getAllAsync<TodoRow>(
    `SELECT * FROM todos WHERE ${where.join(' AND ')} ORDER BY completed_at DESC${limit}`,
    ...params,
  );
  return collect(rows);
}

export async function getTodo(db: SQLiteDatabase, id: string): Promise<Todo | null> {
  const row = await db.getFirstAsync<TodoRow>('SELECT * FROM todos WHERE id = ?', id);
  return row ? rowToTodo(row) : null;
}

export async function insertTodo(db: SQLiteDatabase, todo: Todo): Promise<void> {
  const parsed = TodoSchema.parse(todo);
  await db.runAsync(
    `INSERT INTO todos
      (id, title, note, due_date, sort_order, created_at, completed_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.title,
    parsed.note,
    parsed.dueDate,
    parsed.sortOrder,
    parsed.createdAt,
    parsed.completedAt,
    parsed.protocolVersion,
  );
}

export interface NewTodo {
  title: string;
  note?: string | null;
  dueDate?: string | null;
}

/** Adds to the bottom of the open list. */
export async function createTodo(db: SQLiteDatabase, input: NewTodo): Promise<Todo> {
  const existing = await getAllTodos(db);
  const todo = TodoSchema.parse({
    id: newId(),
    title: input.title,
    note: input.note ?? null,
    dueDate: input.dueDate ?? null,
    sortOrder: nextTodoSortOrder(existing),
    createdAt: new Date().toISOString(),
    completedAt: null,
    protocolVersion: PROTOCOL_VERSION,
  });
  await insertTodo(db, todo);
  return todo;
}

export interface TodoPatch {
  title: string;
  note?: string | null;
  dueDate?: string | null;
}

/** Edits the fields the editor owns. Completion is `setTodoCompleted`'s job. */
export async function updateTodo(
  db: SQLiteDatabase,
  id: string,
  patch: TodoPatch,
): Promise<Todo | null> {
  const existing = await getTodo(db, id);
  if (!existing) return null;

  const parsed = TodoSchema.parse({
    ...existing,
    title: patch.title,
    note: patch.note ?? null,
    dueDate: patch.dueDate ?? null,
  });
  await db.runAsync(
    'UPDATE todos SET title = ?, note = ?, due_date = ? WHERE id = ?',
    parsed.title,
    parsed.note,
    parsed.dueDate,
    id,
  );
  return parsed;
}

/** `completedAt = null` undoes a tick. */
export async function setTodoCompleted(
  db: SQLiteDatabase,
  id: string,
  completedAt: string | null,
): Promise<Todo | null> {
  const existing = await getTodo(db, id);
  if (!existing) return null;

  const parsed = TodoSchema.parse({ ...existing, completedAt });
  await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', parsed.completedAt, id);
  return parsed;
}

export async function deleteTodo(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM todos WHERE id = ?', id);
}

/**
 * Redistributes the sort orders these ids already hold, in the new sequence.
 * Reusing their own slots is what keeps a drag inside one section from
 * renumbering — and so reordering — todos in every other section.
 */
export async function reorderTodos(
  db: SQLiteDatabase,
  orderedIds: readonly string[],
): Promise<void> {
  const all = await getAllTodos(db);
  const byId = new Map(all.map((todo) => [todo.id, todo]));

  const moving = orderedIds.filter((id) => byId.has(id));
  if (moving.length < 2) return;

  const slots = moving
    .map((id) => byId.get(id)!.sortOrder)
    .sort((a, b) => a - b);

  for (const [index, id] of moving.entries()) {
    await db.runAsync('UPDATE todos SET sort_order = ? WHERE id = ?', slots[index], id);
  }
}

export async function deleteAllTodos(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM todos');
}

/**
 * Completed todos are the history page, so they clear with the rest of the
 * activity history. Open todos are pending work, never history — they survive.
 */
export async function deleteCompletedTodos(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM todos WHERE completed_at IS NOT NULL');
}

export async function deleteCompletedTodosBeforeDate(
  db: SQLiteDatabase,
  before: string,
): Promise<void> {
  await db.runAsync(
    "DELETE FROM todos WHERE completed_at IS NOT NULL AND date(completed_at, 'localtime') < ?",
    before,
  );
}

