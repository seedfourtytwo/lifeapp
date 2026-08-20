import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../src/db/migrations';
import * as foodRepo from '../src/db/repositories/foodRepository';
import { FoodItemSchema, PROTOCOL_VERSION } from '../src/protocol';

type Bind = null | number | string;

function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  } as unknown as SQLiteDatabase;
}

function columns(raw: DatabaseSync, table: string): Set<string> {
  return new Set(
    (raw.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name),
  );
}

const NEW_COLUMNS = [
  'diversity_key',
  'season_months_json',
  'peak_months_json',
  'glycemic_index',
  'portions_json',
];

/** The shape food_items had when the catalog first landed, before v20. */
const V19_FOOD_ITEMS = `
  CREATE TABLE food_items (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    food_group TEXT NOT NULL,
    counts_as_plant INTEGER,
    aliases_json TEXT,
    nutrients_json TEXT,
    created_at TEXT NOT NULL,
    archived_at TEXT,
    protocol_version INTEGER NOT NULL
  );`;

describe('food schema upgrade paths', () => {
  let raw: DatabaseSync;
  let db: SQLiteDatabase;

  beforeEach(() => {
    raw = new DatabaseSync(':memory:');
    db = wrap(raw);
  });

  afterEach(() => {
    raw.close();
  });

  it('creates a complete food_items on a fresh install', async () => {
    await runMigrations(db);
    const cols = columns(raw, 'food_items');
    for (const column of NEW_COLUMNS) expect(cols.has(column)).toBe(true);
  });

  it('upgrades a database that stopped at v18, before food existed', async () => {
    raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL);');
    raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(18);

    await runMigrations(db);

    const cols = columns(raw, 'food_items');
    for (const column of NEW_COLUMNS) expect(cols.has(column)).toBe(true);
  });

  /**
   * Regression: v19 was edited in place to add these columns. A device that had
   * already run the original v19 sat at the steady state, where CREATE TABLE IF
   * NOT EXISTS is a no-op and the repair pass is skipped — so the columns never
   * arrived and the first insert failed on `no such column`.
   */
  it('adds the new columns to a database left on the original v19', async () => {
    raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL);');
    raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(19);
    raw.exec(V19_FOOD_ITEMS);
    raw
      .prepare(
        `INSERT INTO food_items (id, slug, name, food_group, created_at, protocol_version)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('00000000-0000-4000-8000-000000000001', 'carrot', 'Carrot', 'vegetable',
           '2026-08-17T09:00:00.000Z', 1);

    await runMigrations(db);

    const cols = columns(raw, 'food_items');
    for (const column of NEW_COLUMNS) expect(cols.has(column)).toBe(true);

    // The food that was already there survives the upgrade.
    const existing = await foodRepo.getAllFoodItems(db);
    expect(existing.map((i) => i.name)).toEqual(['Carrot']);

    // And a fully populated insert now works, which is what used to blow up.
    await foodRepo.insertFoodItem(
      db,
      FoodItemSchema.parse({
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Apple',
        group: 'fruit',
        diversityKey: 'apple',
        seasonMonths: [8, 9, 10],
        peakMonths: [9],
        glycemicIndex: 36,
        portions: [{ label: '1 medium', grams: 182 }],
        createdAt: '2026-08-17T09:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
      }),
    );
    const apple = (await foodRepo.getAllFoodItems(db)).find((i) => i.name === 'Apple');
    expect(apple?.seasonMonths).toEqual([8, 9, 10]);
    expect(apple?.glycemicIndex).toBe(36);
  });

  it('is idempotent across repeated boots', async () => {
    await runMigrations(db);
    await runMigrations(db);
    await runMigrations(db);
    const version = raw.prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(version.version).toBe(20);
    expect(columns(raw, 'food_items').has('portions_json')).toBe(true);
  });
});
