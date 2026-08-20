import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';

/**
 * Food catalog — a Life Protocol *catalog*, not an `ElementKind` (see
 * `.cursor/protocol-plan.md`). Foods are a user-owned library; eating one is
 * recorded in the food log, not in `events` (which foreign-key to `elements`).
 */

export const FOOD_GROUPS = [
  'vegetable',
  'fruit',
  'legume',
  'grain',
  'nut',
  'seed',
  'herbSpice',
  'mushroom',
  'animal',
  'dairy',
  'other',
] as const;

export type FoodGroup = (typeof FOOD_GROUPS)[number];

export const FoodGroupSchema = z.enum(FOOD_GROUPS);

/**
 * Groups that count toward the weekly plant-diversity target by default.
 * Mushrooms are fungi rather than plants, but the popular "30 plants a week"
 * rule counts them, so they stay in. Per-item `countsAsPlant` overrides this
 * for the edge cases (refined white bread out, a plant-based group member in).
 */
export const PLANT_FOOD_GROUPS = [
  'vegetable',
  'fruit',
  'legume',
  'grain',
  'nut',
  'seed',
  'herbSpice',
  'mushroom',
] as const satisfies readonly FoodGroup[];

const PLANT_FOOD_GROUP_SET = new Set<FoodGroup>(PLANT_FOOD_GROUPS);

/** Distinct plants aimed for per Mon–Sun week. */
export const WEEKLY_PLANT_TARGET = 30;

export const FOOD_NAME_MAX_LENGTH = 60;
export const FOOD_ALIAS_MAX = 8;
export const FOOD_PORTION_MAX = 6;

/** Reference basis for every nutrient value on an item. */
export const FOOD_NUTRIENT_BASES = ['per100g', 'per100ml'] as const;
export type FoodNutrientBasis = (typeof FOOD_NUTRIENT_BASES)[number];
export const FoodNutrientBasisSchema = z.enum(FOOD_NUTRIENT_BASES);

/**
 * Which form the values describe. Dry and cooked differ by roughly 3× for
 * grains and pulses, so an unmarked row is the easiest way to be badly wrong.
 */
export const FOOD_STATES = ['raw', 'cooked', 'dry'] as const;
export type FoodState = (typeof FOOD_STATES)[number];
export const FoodStateSchema = z.enum(FOOD_STATES);

const nutrientAmount = z.number().nonnegative().finite().optional();

/**
 * Per-100 nutrition, **EU labelling convention (Reg. 1169/2011)**:
 * `carbsG` is *available* carbohydrate and does **not** include fibre, so a
 * value can be copied straight off a European package. Reference tables that
 * follow the USDA convention include fibre in carbohydrate — subtract `fiberG`
 * before entering. `sugarsG` is a subset of `carbsG`; `satFatG` of `fatG`.
 */
export const FoodNutrientsSchema = z
  .object({
    basis: FoodNutrientBasisSchema.default('per100g'),
    state: FoodStateSchema.optional(),
    energyKcal: nutrientAmount,
    proteinG: nutrientAmount,
    carbsG: nutrientAmount,
    sugarsG: nutrientAmount,
    fatG: nutrientAmount,
    satFatG: nutrientAmount,
    fiberG: nutrientAmount,
    saltG: nutrientAmount,
  })
  .refine(
    (n) => n.sugarsG == null || n.carbsG == null || n.sugarsG <= n.carbsG + 0.01,
    { message: 'sugarsG cannot exceed carbsG (sugars are part of carbohydrate)', path: ['sugarsG'] },
  )
  .refine((n) => n.satFatG == null || n.fatG == null || n.satFatG <= n.fatG + 0.01, {
    message: 'satFatG cannot exceed fatG',
    path: ['satFatG'],
  });

export type FoodNutrients = z.infer<typeof FoodNutrientsSchema>;
/** Same shape before defaults are applied — `basis` may be omitted on write. */
export type FoodNutrientsInput = z.input<typeof FoodNutrientsSchema>;

/** Calendar months a food is in season locally, 1 = January. */
const MonthSchema = z.number().int().min(1).max(12);
const MonthListSchema = z.array(MonthSchema).min(1).max(12);

/** A named amount, so logging does not mean typing grams. */
export const FoodPortionSchema = z.object({
  label: z.string().trim().min(1).max(30),
  grams: z.number().positive().finite().max(5000),
});

export type FoodPortion = z.infer<typeof FoodPortionSchema>;

/** Highest published glycemic index values sit slightly above pure glucose. */
const GLYCEMIC_INDEX_MAX = 110;

/**
 * Everything describing a food is optional except `name` and `group`:
 * `name` because a food with no name cannot be shown or searched, `group`
 * because it decides whether the item counts toward the weekly plant target —
 * defaulting that silently would quietly break the number the app exists for.
 * Fill the rest gradually; a bare `{ name, group }` item is valid.
 */
export const FoodItemSchema = z
  .object({
    id: z.string().uuid(),
    /** Stable key for items that came from the bundled starter list; absent for hand-added foods. */
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(60)
      .optional(),
    name: z.string().trim().min(1).max(FOOD_NAME_MAX_LENGTH),
    group: FoodGroupSchema,
    /** Explicit override of the group's default plant status. */
    countsAsPlant: z.boolean().optional(),
    /**
     * Shared by items that are the same plant, so varieties count once toward
     * the weekly target — Granny Smith and Pink Lady both use `apple`.
     * Defaults to the item's own slug, then its id.
     */
    diversityKey: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(60)
      .optional(),
    /** Extra search terms (other language, local name, brand). */
    aliases: z
      .array(z.string().trim().min(1).max(FOOD_NAME_MAX_LENGTH))
      .max(FOOD_ALIAS_MAX)
      .optional(),
    /** Months this is in season *where the user lives* — not a global fact. */
    seasonMonths: MonthListSchema.optional(),
    /** Best months within `seasonMonths`. */
    peakMonths: MonthListSchema.optional(),
    nutrients: FoodNutrientsSchema.optional(),
    /**
     * Glycemic index of the food *as typically eaten*, not of the raw
     * ingredient — cooking, ripeness and variety all move it. Only meaningful
     * when the food carries carbohydrate. Glycemic load is derived, never stored.
     */
    glycemicIndex: z.number().min(0).max(GLYCEMIC_INDEX_MAX).optional(),
    portions: z.array(FoodPortionSchema).max(FOOD_PORTION_MAX).optional(),
    createdAt: z.string().datetime(),
    /** Soft-hide, same idea as `elements.archived_at` — keeps past log rows readable. */
    archivedAt: z.string().datetime().nullable().optional(),
    protocolVersion: z.literal(PROTOCOL_VERSION),
  })
  .refine(
    (item) =>
      item.peakMonths == null ||
      item.seasonMonths == null ||
      item.peakMonths.every((month) => item.seasonMonths?.includes(month)),
    { message: 'peakMonths must be a subset of seasonMonths', path: ['peakMonths'] },
  );

export type FoodItem = z.infer<typeof FoodItemSchema>;

/**
 * One "I ate this" fact for a calendar day. No quantity yet: v1 answers
 * "which distinct foods this week", and amounts arrive as an additive column.
 */
export const FoodLogEntrySchema = z.object({
  id: z.string().uuid(),
  foodId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  loggedAt: z.string().datetime(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type FoodLogEntry = z.infer<typeof FoodLogEntrySchema>;

export function isPlantFoodGroup(group: FoodGroup): boolean {
  return PLANT_FOOD_GROUP_SET.has(group);
}

/** Whether this food counts toward the weekly plant target. */
export function isPlantFood(item: Pick<FoodItem, 'group' | 'countsAsPlant'>): boolean {
  return item.countsAsPlant ?? isPlantFoodGroup(item.group);
}

/**
 * The value distinct-plant counting deduplicates on. Falling back to the slug
 * means a starter food and a variety the user adds later line up by setting one
 * field; falling back to the id keeps unrelated hand-added foods separate.
 */
export function foodDiversityKey(item: Pick<FoodItem, 'id' | 'slug' | 'diversityKey'>): string {
  return item.diversityKey ?? item.slug ?? item.id;
}

/**
 * Glycemic load per 100 g/ml — derived, so it can never drift from its inputs.
 * `carbsG` is already available carbohydrate under the EU convention this
 * schema stores, so no fibre subtraction is needed here.
 */
export function glycemicLoadPer100(
  item: Pick<FoodItem, 'glycemicIndex' | 'nutrients'>,
): number | null {
  const carbs = item.nutrients?.carbsG;
  if (item.glycemicIndex == null || carbs == null) return null;
  return (item.glycemicIndex * carbs) / 100;
}

/** `month` is 1-based. Foods with no season recorded are never "in season". */
export function isFoodInSeason(
  item: Pick<FoodItem, 'seasonMonths'>,
  month: number,
): boolean {
  return item.seasonMonths?.includes(month) ?? false;
}

export function isFoodInPeakSeason(
  item: Pick<FoodItem, 'peakMonths'>,
  month: number,
): boolean {
  return item.peakMonths?.includes(month) ?? false;
}

export function validateBundleFoodLinks(
  items: FoodItem[],
  log: FoodLogEntry[],
): void {
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const item of items) {
    if (seenIds.has(item.id)) {
      throw new Error(`Duplicate food item ${item.id}`);
    }
    seenIds.add(item.id);
    if (item.slug) {
      if (seenSlugs.has(item.slug)) {
        throw new Error(`Duplicate food slug ${item.slug}`);
      }
      seenSlugs.add(item.slug);
    }
  }

  const seenDayFood = new Set<string>();
  for (const entry of log) {
    if (!seenIds.has(entry.foodId)) {
      throw new Error(`Food log entry ${entry.id} references unknown food ${entry.foodId}`);
    }
    const key = `${entry.date}|${entry.foodId}`;
    if (seenDayFood.has(key)) {
      throw new Error(`Duplicate food log entry for ${entry.foodId} on ${entry.date}`);
    }
    seenDayFood.add(key);
  }
}
