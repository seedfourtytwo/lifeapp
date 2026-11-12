import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  CommitmentConfig,
  DashboardItem,
  ElementDefinition,
  ElementKind,
  LifeEvent,
} from '../../protocol';
import {
  assertElementConfig,
  CommitmentConfigSchema,
  CounterConfigSchema,
  ElementDefinitionSchema,
  HabitConfigSchema,
  PROTOCOL_VERSION,
} from '../../protocol';
import { ensureElementsSchema } from '../schemaIntegrity';
import * as dashboardRepo from './dashboardRepository';
import * as eventRepo from './eventRepository';

interface ElementRow {
  id: string;
  kind: string;
  name: string;
  config_json: string;
  protocol_version: number;
  created_at: string;
  archived_at: string | null;
}

/**
 * The one place a stored config is parsed. Its defaults are kept, so nothing
 * downstream re-parses or casts: it narrows on `kind` and reads the config.
 */
function rowToElement(row: ElementRow): ElementDefinition {
  const base = {
    id: row.id,
    name: row.name,
    protocolVersion: PROTOCOL_VERSION,
    createdAt: row.created_at,
    archivedAt: row.archived_at ?? null,
  };
  const config: unknown = JSON.parse(row.config_json);
  switch (row.kind) {
    case 'habit':
      return { ...base, kind: 'habit', config: HabitConfigSchema.parse(config) };
    case 'counter':
      return { ...base, kind: 'counter', config: CounterConfigSchema.parse(config) };
    case 'commitment':
      return { ...base, kind: 'commitment', config: CommitmentConfigSchema.parse(config) };
    default:
      throw new Error(`Unknown element kind: ${row.kind}`);
  }
}

export async function getAllElements(db: SQLiteDatabase): Promise<ElementDefinition[]> {
  const rows = await db.getAllAsync<ElementRow>(
    'SELECT * FROM elements ORDER BY created_at ASC',
  );
  const elements: ElementDefinition[] = [];
  for (const row of rows) {
    try {
      elements.push(rowToElement(row));
    } catch (error) {
      console.warn(
        `Skipping corrupt element ${row.id} (${row.kind}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return elements;
}

/** Lighter than getElementById — skips config validation when only createdAt is needed. */
export async function getElementCreatedAt(
  db: SQLiteDatabase,
  id: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ created_at: string }>(
    'SELECT created_at FROM elements WHERE id = ?',
    id,
  );
  return row?.created_at ?? null;
}

export async function getElementById(
  db: SQLiteDatabase,
  id: string,
): Promise<ElementDefinition | null> {
  const row = await db.getFirstAsync<ElementRow>(
    'SELECT * FROM elements WHERE id = ?',
    id,
  );
  if (!row) return null;
  try {
    return rowToElement(row);
  } catch (error) {
    console.warn(
      `Skipping corrupt element ${row.id} (${row.kind}):`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function insertElement(
  db: SQLiteDatabase,
  element: ElementDefinition,
): Promise<void> {
  ElementDefinitionSchema.parse(element);

  await db.runAsync(
    `INSERT INTO elements (id, kind, name, config_json, protocol_version, created_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    element.id,
    element.kind,
    element.name,
    JSON.stringify(element.config),
    element.protocolVersion,
    element.createdAt,
    element.archivedAt ?? null,
  );
}

/**
 * Store a new name and config as given. Migrations pass raw configs that still
 * carry fields later steps read, so the config is checked, not rewritten.
 */
export async function updateElement(
  db: SQLiteDatabase,
  id: string,
  updates: { name: string; config: Record<string, unknown> },
  kind: ElementKind,
): Promise<void> {
  assertElementConfig(kind, updates.config);

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

/** Insert a new active element and pin it to Home atomically. */
export async function insertElementWithDashboardItem(
  db: SQLiteDatabase,
  element: ElementDefinition,
  dashboardItem: DashboardItem,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await insertElement(db, element);
    await dashboardRepo.insertDashboardItem(db, dashboardItem);
  });
}

/** Archive an element and drop its Home pin atomically. */
export async function archiveElementAndUnpin(
  db: SQLiteDatabase,
  id: string,
  archivedAt: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await setElementArchivedAt(db, id, archivedAt);
    await dashboardRepo.deleteDashboardItemForElement(db, id);
  });
}

/**
 * Unarchive an element and (re)pin it to Home atomically, returning its pin.
 * `newPinId` is used only if the element needs a fresh pin (caller generates
 * it — repositories don't mint ids).
 */
export async function restoreElementAndPin(
  db: SQLiteDatabase,
  id: string,
  newPinId: string,
): Promise<DashboardItem> {
  let pin: DashboardItem | null = null;
  await db.withTransactionAsync(async () => {
    await setElementArchivedAt(db, id, null);
    const alreadyActive = await dashboardRepo.isElementOnDashboard(db, id);
    if (!alreadyActive) {
      pin = {
        id: newPinId,
        elementId: id,
        sortOrder: await dashboardRepo.getNextSortOrder(db),
      };
      await dashboardRepo.insertDashboardItem(db, pin);
      return;
    }
    pin = (await dashboardRepo.getDashboardItems(db)).find(
      (item) => item.elementId === id,
    ) ?? null;
  });
  if (!pin) {
    throw new Error(`Dashboard pin missing for restored element ${id}`);
  }
  return pin;
}

/**
 * Take back a slip logged by mistake: its event goes, and clear-since
 * returns to `config`'s, both or neither.
 */
export async function removeSlip(
  db: SQLiteDatabase,
  commitmentId: string,
  slipId: string,
  config: CommitmentConfig,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    assertElementConfig('commitment', config);
    await eventRepo.deleteEventsByIds(db, commitmentId, [slipId]);
    await db.runAsync(
      'UPDATE elements SET config_json = ? WHERE id = ?',
      JSON.stringify(config),
      commitmentId,
    );
  });
}

/** Append a slip and move the commitment's clear-since to it, both or neither. */
export async function recordSlip(
  db: SQLiteDatabase,
  commitmentId: string,
  slip: LifeEvent,
  config: CommitmentConfig,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    assertElementConfig('commitment', config);
    await eventRepo.insertEvent(db, slip);
    await db.runAsync(
      'UPDATE elements SET config_json = ? WHERE id = ?',
      JSON.stringify(config),
      commitmentId,
    );
  });
}
