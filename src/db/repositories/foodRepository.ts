import type { SQLiteDatabase } from 'expo-sqlite';
import {
  FoodItemSchema,
  FoodLogEntrySchema,
  PROTOCOL_VERSION,
  type FoodItem,
  type FoodLogEntry,
  type FoodNutrientsInput,
} from '../../protocol';
import { newId } from '../../utils/id';

interface FoodItemRow {
  id: string;
  slug: string | null;
  name: string;
  food_group: string;
  counts_as_plant: number | null;
  diversity_key: string | null;
  aliases_json: string | null;
  season_months_json: string | null;
  peak_months_json: string | null;
  nutrients_json: string | null;
  glycemic_index: number | null;
  portions_json: string | null;
  created_at: string;
  archived_at: string | null;
  protocol_version: number;
}

interface FoodLogRow {
  id: string;
  food_id: string;
  date: string;
  logged_at: string;
  protocol_version: number;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function rowToItem(row: FoodItemRow): FoodItem {
  return FoodItemSchema.parse({
    id: row.id,
    slug: row.slug ?? undefined,
    name: row.name,
    group: row.food_group,
    countsAsPlant: row.counts_as_plant == null ? undefined : row.counts_as_plant === 1,
    diversityKey: row.diversity_key ?? undefined,
    aliases: parseJson(row.aliases_json),
    seasonMonths: parseJson(row.season_months_json),
    peakMonths: parseJson(row.peak_months_json),
    nutrients: parseJson(row.nutrients_json),
    glycemicIndex: row.glycemic_index ?? undefined,
    portions: parseJson(row.portions_json),
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    protocolVersion: PROTOCOL_VERSION,
  });
}

/** `undefined` for empty arrays keeps optional columns NULL instead of "[]". */
function jsonOrNull(value: readonly unknown[] | undefined): string | null {
  return value && value.length > 0 ? JSON.stringify(value) : null;
}

/** Rows written by an older or corrupted build must not break the whole list. */
function tryRowToItem(row: FoodItemRow): FoodItem | null {
  try {
    return rowToItem(row);
  } catch {
    return null;
  }
}

function rowToLogEntry(row: FoodLogRow): FoodLogEntry {
  return FoodLogEntrySchema.parse({
    id: row.id,
    foodId: row.food_id,
    date: row.date,
    loggedAt: row.logged_at,
    protocolVersion: PROTOCOL_VERSION,
  });
}

function collectItems(rows: FoodItemRow[]): FoodItem[] {
  const items: FoodItem[] = [];
  for (const row of rows) {
    const item = tryRowToItem(row);
    if (item) items.push(item);
  }
  return items;
}

/** Catalog for browsing and search — archived foods excluded. */
export async function getActiveFoodItems(db: SQLiteDatabase): Promise<FoodItem[]> {
  const rows = await db.getAllAsync<FoodItemRow>(
    'SELECT * FROM food_items WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE ASC',
  );
  return collectItems(rows);
}

/** Every food including archived ones — for backup and for resolving old log rows. */
export async function getAllFoodItems(db: SQLiteDatabase): Promise<FoodItem[]> {
  const rows = await db.getAllAsync<FoodItemRow>(
    'SELECT * FROM food_items ORDER BY name COLLATE NOCASE ASC',
  );
  return collectItems(rows);
}

export async function getFoodItem(db: SQLiteDatabase, id: string): Promise<FoodItem | null> {
  const row = await db.getFirstAsync<FoodItemRow>('SELECT * FROM food_items WHERE id = ?', id);
  return row ? tryRowToItem(row) : null;
}

export async function getExistingFoodSlugs(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ slug: string }>(
    'SELECT slug FROM food_items WHERE slug IS NOT NULL',
  );
  return new Set(rows.map((row) => row.slug));
}

export async function insertFoodItem(db: SQLiteDatabase, item: FoodItem): Promise<void> {
  const parsed = FoodItemSchema.parse(item);
  await db.runAsync(
    `INSERT INTO food_items
      (id, slug, name, food_group, counts_as_plant, diversity_key, aliases_json,
       season_months_json, peak_months_json, nutrients_json, glycemic_index,
       portions_json, created_at, archived_at, protocol_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.slug ?? null,
    parsed.name,
    parsed.group,
    parsed.countsAsPlant == null ? null : parsed.countsAsPlant ? 1 : 0,
    parsed.diversityKey ?? null,
    jsonOrNull(parsed.aliases),
    jsonOrNull(parsed.seasonMonths),
    jsonOrNull(parsed.peakMonths),
    parsed.nutrients ? JSON.stringify(parsed.nutrients) : null,
    parsed.glycemicIndex ?? null,
    jsonOrNull(parsed.portions),
    parsed.createdAt,
    parsed.archivedAt ?? null,
    parsed.protocolVersion,
  );
}

export async function updateFoodItem(
  db: SQLiteDatabase,
  id: string,
  patch: Pick<FoodItem, 'name' | 'group'> &
    Partial<
      Pick<
        FoodItem,
        | 'countsAsPlant'
        | 'diversityKey'
        | 'aliases'
        | 'seasonMonths'
        | 'peakMonths'
        | 'glycemicIndex'
        | 'portions'
      >
      // Pre-parse shape: `basis` may be omitted and is defaulted by Zod.
    > & { nutrients?: FoodNutrientsInput },
): Promise<FoodItem | null> {
  const existing = await getFoodItem(db, id);
  if (!existing) return null;
  const parsed = FoodItemSchema.parse({
    ...existing,
    name: patch.name,
    group: patch.group,
    countsAsPlant: patch.countsAsPlant,
    diversityKey: patch.diversityKey,
    aliases: patch.aliases,
    seasonMonths: patch.seasonMonths,
    peakMonths: patch.peakMonths,
    nutrients: patch.nutrients,
    glycemicIndex: patch.glycemicIndex,
    portions: patch.portions,
  });
  await db.runAsync(
    `UPDATE food_items
     SET name = ?, food_group = ?, counts_as_plant = ?, diversity_key = ?,
         aliases_json = ?, season_months_json = ?, peak_months_json = ?,
         nutrients_json = ?, glycemic_index = ?, portions_json = ?
     WHERE id = ?`,
    parsed.name,
    parsed.group,
    parsed.countsAsPlant == null ? null : parsed.countsAsPlant ? 1 : 0,
    parsed.diversityKey ?? null,
    jsonOrNull(parsed.aliases),
    jsonOrNull(parsed.seasonMonths),
    jsonOrNull(parsed.peakMonths),
    parsed.nutrients ? JSON.stringify(parsed.nutrients) : null,
    parsed.glycemicIndex ?? null,
    jsonOrNull(parsed.portions),
    id,
  );
  return getFoodItem(db, id);
}

export async function setFoodItemArchivedAt(
  db: SQLiteDatabase,
  id: string,
  archivedAt: string | null,
): Promise<void> {
  await db.runAsync('UPDATE food_items SET archived_at = ? WHERE id = ?', archivedAt, id);
}

export async function countFoodLogEntriesForFood(
  db: SQLiteDatabase,
  foodId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM food_log WHERE food_id = ?',
    foodId,
  );
  return row?.n ?? 0;
}

export async function deleteFoodItem(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM food_items WHERE id = ?', id);
}

export async function getFoodLogForDates(
  db: SQLiteDatabase,
  dates: readonly string[],
): Promise<FoodLogEntry[]> {
  if (dates.length === 0) return [];
  const placeholders = dates.map(() => '?').join(', ');
  const rows = await db.getAllAsync<FoodLogRow>(
    `SELECT * FROM food_log WHERE date IN (${placeholders}) ORDER BY logged_at ASC`,
    ...dates,
  );
  return rows.map(rowToLogEntry);
}

export async function getAllFoodLog(db: SQLiteDatabase): Promise<FoodLogEntry[]> {
  const rows = await db.getAllAsync<FoodLogRow>('SELECT * FROM food_log ORDER BY date ASC');
  return rows.map(rowToLogEntry);
}

/** Idempotent: logging the same food twice on one day is a no-op, not a duplicate. */
export async function addFoodLogEntry(
  db: SQLiteDatabase,
  input: { foodId: string; date: string },
): Promise<void> {
  const parsed = FoodLogEntrySchema.parse({
    id: newId(),
    foodId: input.foodId,
    date: input.date,
    loggedAt: new Date().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
  });
  await db.runAsync(
    `INSERT OR IGNORE INTO food_log (id, food_id, date, logged_at, protocol_version)
     VALUES (?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.foodId,
    parsed.date,
    parsed.loggedAt,
    parsed.protocolVersion,
  );
}

export async function insertFoodLogEntry(
  db: SQLiteDatabase,
  entry: FoodLogEntry,
): Promise<void> {
  const parsed = FoodLogEntrySchema.parse(entry);
  await db.runAsync(
    `INSERT OR IGNORE INTO food_log (id, food_id, date, logged_at, protocol_version)
     VALUES (?, ?, ?, ?, ?)`,
    parsed.id,
    parsed.foodId,
    parsed.date,
    parsed.loggedAt,
    parsed.protocolVersion,
  );
}

export async function removeFoodLogEntry(
  db: SQLiteDatabase,
  input: { foodId: string; date: string },
): Promise<void> {
  await db.runAsync(
    'DELETE FROM food_log WHERE food_id = ? AND date = ?',
    input.foodId,
    input.date,
  );
}

export async function deleteAllFoodLog(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM food_log');
}

export async function deleteFoodLogBeforeDate(
  db: SQLiteDatabase,
  before: string,
): Promise<void> {
  await db.runAsync('DELETE FROM food_log WHERE date < ?', before);
}
