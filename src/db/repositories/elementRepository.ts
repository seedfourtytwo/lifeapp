import type { SQLiteDatabase } from 'expo-sqlite';
import type { ElementDefinition, ElementKind } from '../../protocol';
import { PROTOCOL_VERSION, validateElementConfig } from '../../protocol';
import { ensureElementsSchema } from '../schemaIntegrity';

interface ElementRow {
  id: string;
  kind: string;
  name: string;
  category: string;
  parent_id: string | null;
  config_json: string;
  protocol_version: number;
  created_at: string;
  archived_at: string | null;
}

function rowToElement(row: ElementRow): ElementDefinition {
  const config = JSON.parse(row.config_json) as Record<string, unknown>;
  validateElementConfig(row.kind as ElementKind, config);

  return {
    id: row.id,
    kind: row.kind as ElementKind,
    name: row.name,
    config,
    protocolVersion: PROTOCOL_VERSION,
    createdAt: row.created_at,
    archivedAt: row.archived_at ?? null,
  };
}

export async function getAllElements(db: SQLiteDatabase): Promise<ElementDefinition[]> {
  const rows = await db.getAllAsync<ElementRow>(
    'SELECT * FROM elements ORDER BY created_at ASC',
  );
  return rows.map(rowToElement);
}

export async function getElementById(
  db: SQLiteDatabase,
  id: string,
): Promise<ElementDefinition | null> {
  const row = await db.getFirstAsync<ElementRow>(
    'SELECT * FROM elements WHERE id = ?',
    id,
  );
  return row ? rowToElement(row) : null;
}

export async function insertElement(
  db: SQLiteDatabase,
  element: ElementDefinition,
): Promise<void> {
  validateElementConfig(element.kind, element.config);

  await db.runAsync(
    `INSERT INTO elements (id, kind, name, category, parent_id, config_json, protocol_version, created_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    element.id,
    element.kind,
    element.name,
    '',
    null,
    JSON.stringify(element.config),
    element.protocolVersion,
    element.createdAt,
    element.archivedAt ?? null,
  );
}

export async function updateElement(
  db: SQLiteDatabase,
  id: string,
  updates: Pick<ElementDefinition, 'name' | 'config'>,
  kind: ElementKind,
): Promise<void> {
  validateElementConfig(kind, updates.config);

  await db.runAsync(
    `UPDATE elements SET name = ?, config_json = ? WHERE id = ?`,
    updates.name,
    JSON.stringify(updates.config),
    id,
  );
}

export async function deleteElement(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM elements WHERE id = ?', id);
}

export async function setElementArchivedAt(
  db: SQLiteDatabase,
  id: string,
  archivedAt: string | null,
): Promise<void> {
  await ensureElementsSchema(db);
  await db.runAsync('UPDATE elements SET archived_at = ? WHERE id = ?', archivedAt, id);
}
