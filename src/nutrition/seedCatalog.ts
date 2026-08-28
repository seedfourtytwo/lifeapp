import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';
import {
  FoodGroupSchema,
  FoodItemSchema,
  FoodNutrientsSchema,
  FoodPortionSchema,
  PROTOCOL_VERSION,
  FOOD_ALIAS_MAX,
  FOOD_NAME_MAX_LENGTH,
  FOOD_PORTION_MAX,
  type FoodItem,
} from '../protocol';
import { getDatabase } from '../db/client';
import * as foodRepo from '../db/repositories/foodRepository';
import * as settingsRepo from '../db/repositories/settingsRepository';
import { SEED_APPLIED_SLUGS_KEY } from './seedFoodState';
import { newId } from '../utils/id';
import seedData from './seed/foods.json';

/**
 * Bundled starter foods. This is a scaffold to prune and extend, not a
 * reference database — nutrient values are approximate per-100 figures and
 * should be corrected against the packaging you actually buy.
 *
 * Seeding is *additive and one-shot per slug*: the slugs already applied are
 * remembered, so foods you delete stay deleted and foods you edit stay edited
 * even when this file grows.
 */

const MonthListSchema = z.array(z.number().int().min(1).max(12)).min(1).max(12);

const SeedItemSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60),
  en: z.string().trim().min(1).max(FOOD_NAME_MAX_LENGTH),
  /** Optional — an untranslated food simply shows its English name in French. */
  fr: z.string().trim().min(1).max(FOOD_NAME_MAX_LENGTH).optional(),
  group: FoodGroupSchema,
  countsAsPlant: z.boolean().optional(),
  diversityKey: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60)
    .optional(),
  aliases: z.array(z.string().trim().min(1).max(FOOD_NAME_MAX_LENGTH)).max(FOOD_ALIAS_MAX).optional(),
  seasonMonths: MonthListSchema.optional(),
  peakMonths: MonthListSchema.optional(),
  nutrients: FoodNutrientsSchema.optional(),
  glycemicIndex: z.number().min(0).max(110).optional(),
  portions: z.array(FoodPortionSchema).max(FOOD_PORTION_MAX).optional(),
});

const SeedFileSchema = z.object({
  version: z.number().int().positive(),
  /** Conventions, carried in the data file itself so they travel with it. */
  note: z.string().optional(),
  /** A filled-in item kept beside the list as a copy-paste template. */
  example: z.unknown().optional(),
  items: z.array(SeedItemSchema),
});

export type SeedFoodItem = z.infer<typeof SeedItemSchema>;

/** Parsed once at module load — a malformed seed file must fail loudly in tests, not at runtime. */
export const SEED_FOODS: SeedFoodItem[] = SeedFileSchema.parse(seedData).items;

const SEED_BY_SLUG = new Map(SEED_FOODS.map((item) => [item.slug, item]));

/**
 * A seed food the user has renamed: its stored name matches neither shipped
 * name. Comparing against both means opening the editor in French and saving
 * without changing anything does not count as a rename.
 */
function isRenamedSeedFood(name: string, seed: SeedFoodItem): boolean {
  return name !== seed.en && name !== seed.fr;
}

/**
 * Resolve a display name against a known seed entry. Pure — the seed lookup is
 * the caller's job, so this stays testable as the shipped list changes.
 */
export function resolveFoodLabel(
  item: Pick<FoodItem, 'name'>,
  seed: SeedFoodItem | undefined,
  language: string,
): string {
  if (!seed || isRenamedSeedFood(item.name, seed)) return item.name;
  return language.startsWith('fr') ? (seed.fr ?? seed.en) : seed.en;
}

/** Every name a food is known by, given its seed entry (if any). */
export function resolveFoodSearchTerms(
  item: Pick<FoodItem, 'name' | 'aliases'>,
  seed: SeedFoodItem | undefined,
): string[] {
  const terms = [item.name, ...(item.aliases ?? [])];
  if (seed) {
    terms.push(seed.en, ...(seed.fr ? [seed.fr] : []), ...(seed.aliases ?? []));
  }
  return terms;
}

export function seedFoodForSlug(slug: string | undefined): SeedFoodItem | undefined {
  return slug ? SEED_BY_SLUG.get(slug) : undefined;
}

/**
 * Display name for a catalog item in the active language. Seed foods are
 * translated from the seed file itself; hand-added foods — and seed foods the
 * user renamed — keep the name that was typed in.
 */
export function foodDisplayName(item: Pick<FoodItem, 'slug' | 'name'>, language: string): string {
  return resolveFoodLabel(item, seedFoodForSlug(item.slug), language);
}

/** Every name a food is known by, for search matching across languages. */
export function foodSearchTerms(item: Pick<FoodItem, 'slug' | 'name' | 'aliases'>): string[] {
  return resolveFoodSearchTerms(item, seedFoodForSlug(item.slug));
}

function parseAppliedSlugs(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function seedToFoodItem(seed: SeedFoodItem, createdAt: string): FoodItem {
  return FoodItemSchema.parse({
    id: newId(),
    slug: seed.slug,
    name: seed.en,
    group: seed.group,
    countsAsPlant: seed.countsAsPlant,
    diversityKey: seed.diversityKey,
    aliases: seed.aliases,
    seasonMonths: seed.seasonMonths,
    peakMonths: seed.peakMonths,
    nutrients: seed.nutrients,
    glycemicIndex: seed.glycemicIndex,
    portions: seed.portions,
    createdAt,
    archivedAt: null,
    protocolVersion: PROTOCOL_VERSION,
  });
}

/**
 * Insert seed foods whose slug has never been applied on this device.
 * Safe to call on every boot. Returns how many were added.
 */
export async function syncSeedFoodCatalog(): Promise<number> {
  const db = await getDatabase();
  return syncSeedFoodCatalogWithDb(db);
}

/**
 * Record every seed slug as applied without inserting anything. Called after
 * importing a backup that carried a food catalog: that catalog is the state the
 * user chose, so starter foods they had deleted must not reappear on next boot.
 */
export async function markSeedFoodsApplied(db: SQLiteDatabase): Promise<void> {
  await settingsRepo.setSetting(
    db,
    SEED_APPLIED_SLUGS_KEY,
    JSON.stringify(SEED_FOODS.map((seed) => seed.slug)),
  );
}

async function syncSeedFoodCatalogWithDb(db: SQLiteDatabase): Promise<number> {
  const applied = parseAppliedSlugs(
    await settingsRepo.getSetting(db, SEED_APPLIED_SLUGS_KEY),
  );
  const existingSlugs = await foodRepo.getExistingFoodSlugs(db);

  const pending = SEED_FOODS.filter(
    (seed) => !applied.has(seed.slug) && !existingSlugs.has(seed.slug),
  );

  // Slugs already in the catalog were applied by an older build — record them
  // so a later delete is not undone by the next boot.
  const nextApplied = new Set(applied);
  for (const seed of SEED_FOODS) {
    if (existingSlugs.has(seed.slug)) nextApplied.add(seed.slug);
  }

  if (pending.length === 0) {
    if (nextApplied.size !== applied.size) {
      await settingsRepo.setSetting(
        db,
        SEED_APPLIED_SLUGS_KEY,
        JSON.stringify([...nextApplied]),
      );
    }
    return 0;
  }

  const createdAt = new Date().toISOString();
  let added = 0;
  for (const seed of pending) {
    try {
      await foodRepo.insertFoodItem(db, seedToFoodItem(seed, createdAt));
      nextApplied.add(seed.slug);
      added += 1;
    } catch (error) {
      // One bad seed row must not block the rest of the catalog.
      console.warn(`Failed to seed food ${seed.slug}`, error);
    }
  }

  await settingsRepo.setSetting(
    db,
    SEED_APPLIED_SLUGS_KEY,
    JSON.stringify([...nextApplied]),
  );
  return added;
}
