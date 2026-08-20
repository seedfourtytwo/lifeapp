import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { ensureFoodSchema } from '../src/db/schemaIntegrity';
import * as foodRepo from '../src/db/repositories/foodRepository';
import { FoodItemSchema, PROTOCOL_VERSION, type FoodItem } from '../src/protocol';

/**
 * Runs the repository's real SQL against a real SQLite, rather than asserting
 * on mock call arguments — constraints, cascades and JSON round-trips are
 * exactly the parts that mocks cannot check.
 */
function createTestDb(): { db: SQLiteDatabase; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');

  // The repository only ever binds these; `undefined` never reaches here
  // because every optional column is coalesced to null before binding.
  type Bind = null | number | string;

  const db = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: Bind[]) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: Bind[]) =>
      raw.prepare(sql).get(...params) ?? null,
  } as unknown as SQLiteDatabase;

  return { db, raw };
}

let counter = 0;
function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function food(overrides: Partial<FoodItem> = {}): FoodItem {
  return FoodItemSchema.parse({
    id: uuid(),
    name: 'Food',
    group: 'vegetable',
    createdAt: '2026-08-17T09:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...overrides,
  });
}

describe('foodRepository against real SQLite', () => {
  let db: SQLiteDatabase;
  let raw: DatabaseSync;

  beforeEach(async () => {
    ({ db, raw } = createTestDb());
    await ensureFoodSchema(db);
  });

  afterEach(() => {
    raw.close();
  });

  it('round-trips a fully populated food', async () => {
    const item = food({
      slug: 'carrot',
      name: 'Carrot',
      group: 'vegetable',
      countsAsPlant: true,
      diversityKey: 'carrot',
      aliases: ['carotte'],
      seasonMonths: [6, 7, 8],
      peakMonths: [7],
      nutrients: {
        basis: 'per100g',
        state: 'raw',
        energyKcal: 41,
        proteinG: 0.9,
        carbsG: 6.8,
        sugarsG: 4.7,
        fatG: 0.2,
        fiberG: 2.8,
      },
      glycemicIndex: 39,
      portions: [{ label: '1 medium', grams: 61 }],
    });
    await foodRepo.insertFoodItem(db, item);

    const stored = await foodRepo.getFoodItem(db, item.id);
    // A never-archived food reads back as `archivedAt: null` rather than
    // absent — the column is NULL. Every caller tests `== null`, so both forms
    // mean the same thing.
    expect(stored).toEqual({ ...item, archivedAt: null });
  });

  it('round-trips a food with only a name and a group', async () => {
    const item = food({ name: 'Kefir', group: 'dairy' });
    await foodRepo.insertFoodItem(db, item);

    const stored = await foodRepo.getFoodItem(db, item.id);
    expect(stored?.name).toBe('Kefir');
    expect(stored?.nutrients).toBeUndefined();
    expect(stored?.seasonMonths).toBeUndefined();
    expect(stored?.portions).toBeUndefined();
    expect(stored?.glycemicIndex).toBeUndefined();
  });

  it('stores empty optional arrays as NULL rather than "[]"', async () => {
    const item = food({ aliases: undefined, seasonMonths: undefined });
    await foodRepo.insertFoodItem(db, item);
    const row = raw
      .prepare('SELECT aliases_json, season_months_json FROM food_items WHERE id = ?')
      .get(item.id) as Record<string, unknown>;
    expect(row.aliases_json).toBeNull();
    expect(row.season_months_json).toBeNull();
  });

  it('rejects a duplicate slug', async () => {
    await foodRepo.insertFoodItem(db, food({ slug: 'carrot' }));
    await expect(foodRepo.insertFoodItem(db, food({ slug: 'carrot' }))).rejects.toThrow();
  });

  it('allows many hand-added foods with no slug', async () => {
    await foodRepo.insertFoodItem(db, food({ name: 'Sauce A' }));
    await foodRepo.insertFoodItem(db, food({ name: 'Sauce B' }));
    expect(await foodRepo.getAllFoodItems(db)).toHaveLength(2);
  });

  it('separates the active catalog from archived foods', async () => {
    const active = food({ name: 'Active' });
    const hidden = food({ name: 'Hidden' });
    await foodRepo.insertFoodItem(db, active);
    await foodRepo.insertFoodItem(db, hidden);
    await foodRepo.setFoodItemArchivedAt(db, hidden.id, '2026-08-19T09:00:00.000Z');

    expect((await foodRepo.getActiveFoodItems(db)).map((i) => i.id)).toEqual([active.id]);
    expect(await foodRepo.getAllFoodItems(db)).toHaveLength(2);

    await foodRepo.setFoodItemArchivedAt(db, hidden.id, null);
    expect(await foodRepo.getActiveFoodItems(db)).toHaveLength(2);
  });

  it('skips a corrupted row instead of failing the whole list', async () => {
    const good = food({ name: 'Good' });
    await foodRepo.insertFoodItem(db, good);
    raw
      .prepare(
        `INSERT INTO food_items (id, name, food_group, created_at, protocol_version)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(uuid(), 'Broken', 'not-a-real-group', '2026-08-17T09:00:00.000Z', 1);

    const items = await foodRepo.getAllFoodItems(db);
    expect(items.map((i) => i.name)).toEqual(['Good']);
  });

  it('updates the fields the editor sends and keeps the rest', async () => {
    const item = food({ slug: 'carrot', name: 'Carrot', seasonMonths: [6, 7] });
    await foodRepo.insertFoodItem(db, item);

    const updated = await foodRepo.updateFoodItem(db, item.id, {
      name: 'Carrot from the garden',
      group: 'vegetable',
      seasonMonths: [8, 9],
      nutrients: { energyKcal: 41 },
    });

    expect(updated?.name).toBe('Carrot from the garden');
    expect(updated?.seasonMonths).toEqual([8, 9]);
    // Defaulted by Zod on the way in.
    expect(updated?.nutrients?.basis).toBe('per100g');
    // Identity fields the editor never touches survive.
    expect(updated?.slug).toBe('carrot');
    expect(updated?.createdAt).toBe(item.createdAt);
  });

  it('returns null when updating a food that is gone', async () => {
    expect(await foodRepo.updateFoodItem(db, uuid(), { name: 'X', group: 'other' })).toBeNull();
  });

  describe('the day log', () => {
    let carrot: FoodItem;

    beforeEach(async () => {
      carrot = food({ name: 'Carrot' });
      await foodRepo.insertFoodItem(db, carrot);
    });

    it('makes logging the same food twice in a day a no-op', async () => {
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });
      expect(await foodRepo.countFoodLogEntriesForFood(db, carrot.id)).toBe(1);
    });

    it('logs the same food on different days separately', async () => {
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-18' });
      expect(await foodRepo.countFoodLogEntriesForFood(db, carrot.id)).toBe(2);
    });

    it('removes only the entry for that day', async () => {
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-18' });
      await foodRepo.removeFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });

      const remaining = await foodRepo.getAllFoodLog(db);
      expect(remaining.map((e) => e.date)).toEqual(['2026-08-18']);
    });

    it('un-logging something never logged is harmless', async () => {
      await expect(
        foodRepo.removeFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' }),
      ).resolves.toBeUndefined();
    });

    it('fetches exactly the requested week', async () => {
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-16' });
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-19' });
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-24' });

      const week = await foodRepo.getFoodLogForDates(db, [
        '2026-08-17',
        '2026-08-18',
        '2026-08-19',
        '2026-08-20',
        '2026-08-21',
        '2026-08-22',
        '2026-08-23',
      ]);
      expect(week.map((e) => e.date)).toEqual(['2026-08-19']);
    });

    it('short-circuits an empty date list', async () => {
      expect(await foodRepo.getFoodLogForDates(db, [])).toEqual([]);
    });

    it('refuses a log row for a food that does not exist', async () => {
      await expect(
        foodRepo.addFoodLogEntry(db, { foodId: uuid(), date: '2026-08-17' }),
      ).rejects.toThrow();
    });

    it('deleting a food takes its history with it — hence archiving instead', async () => {
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });
      await foodRepo.deleteFoodItem(db, carrot.id);
      expect(await foodRepo.getAllFoodLog(db)).toEqual([]);
    });

    it('clears log history from before a cutoff only', async () => {
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-10' });
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });
      await foodRepo.deleteFoodLogBeforeDate(db, '2026-08-17');

      const remaining = await foodRepo.getAllFoodLog(db);
      expect(remaining.map((e) => e.date)).toEqual(['2026-08-17']);
    });

    it('clears the whole log without touching the catalog', async () => {
      await foodRepo.addFoodLogEntry(db, { foodId: carrot.id, date: '2026-08-17' });
      await foodRepo.deleteAllFoodLog(db);

      expect(await foodRepo.getAllFoodLog(db)).toEqual([]);
      expect(await foodRepo.getAllFoodItems(db)).toHaveLength(1);
    });
  });

  it('reports the slugs already in the catalog, for one-shot seeding', async () => {
    await foodRepo.insertFoodItem(db, food({ slug: 'carrot' }));
    await foodRepo.insertFoodItem(db, food({ name: 'No slug' }));
    expect([...(await foodRepo.getExistingFoodSlugs(db))]).toEqual(['carrot']);
  });
});
