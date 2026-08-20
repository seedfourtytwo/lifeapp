import {
  FOOD_ALIAS_MAX,
  FOOD_PORTION_MAX,
  isPlantFoodGroup,
  type FoodGroup,
  type FoodItem,
  type FoodNutrientBasis,
  type FoodState,
} from '../../protocol';
import type { FoodItemInput } from '../../nutrition/foodCatalog';

/**
 * Every numeric field is held as text while editing: a half-typed "1." is not a
 * number yet, and clearing a field must mean "unset" rather than zero.
 */
export interface IngredientDraft {
  name: string;
  group: FoodGroup;
  countsAsPlant: boolean;
  diversityKey: string;
  aliases: string;
  seasonMonths: number[];
  peakMonths: number[];
  basis: FoodNutrientBasis;
  state: FoodState | 'none';
  energyKcal: string;
  proteinG: string;
  carbsG: string;
  sugarsG: string;
  fatG: string;
  satFatG: string;
  fiberG: string;
  saltG: string;
  glycemicIndex: string;
  portions: { label: string; grams: string }[];
}

export const NUMERIC_NUTRIENT_FIELDS = [
  'energyKcal',
  'proteinG',
  'carbsG',
  'sugarsG',
  'fatG',
  'satFatG',
  'fiberG',
  'saltG',
] as const;

export type NumericNutrientField = (typeof NUMERIC_NUTRIENT_FIELDS)[number];

function numberToText(value: number | undefined): string {
  return value == null ? '' : String(value);
}

export function draftFromItem(item: FoodItem | undefined): IngredientDraft {
  const group = item?.group ?? 'vegetable';
  return {
    name: item?.name ?? '',
    group,
    countsAsPlant: item?.countsAsPlant ?? isPlantFoodGroup(group),
    diversityKey: item?.diversityKey ?? '',
    aliases: (item?.aliases ?? []).join(', '),
    seasonMonths: item?.seasonMonths ?? [],
    peakMonths: item?.peakMonths ?? [],
    basis: item?.nutrients?.basis ?? 'per100g',
    state: item?.nutrients?.state ?? 'none',
    energyKcal: numberToText(item?.nutrients?.energyKcal),
    proteinG: numberToText(item?.nutrients?.proteinG),
    carbsG: numberToText(item?.nutrients?.carbsG),
    sugarsG: numberToText(item?.nutrients?.sugarsG),
    fatG: numberToText(item?.nutrients?.fatG),
    satFatG: numberToText(item?.nutrients?.satFatG),
    fiberG: numberToText(item?.nutrients?.fiberG),
    saltG: numberToText(item?.nutrients?.saltG),
    glycemicIndex: numberToText(item?.glycemicIndex),
    portions: (item?.portions ?? []).map((portion) => ({
      label: portion.label,
      grams: String(portion.grams),
    })),
  };
}

/**
 * Parse one numeric field. Accepts a comma decimal separator — a French keyboard
 * puts a comma on the number pad, and rejecting it would look like a bug.
 * Returns `undefined` for empty, `null` for text that is not a number.
 */
export function parseDecimal(raw: string): number | undefined | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function parseAliases(raw: string): string[] | undefined {
  const list = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, FOOD_ALIAS_MAX);
  return list.length > 0 ? list : undefined;
}

export type DraftError =
  | { kind: 'nameRequired' }
  | { kind: 'notANumber'; field: string }
  | { kind: 'portionIncomplete' }
  | { kind: 'sugarsAboveCarbs' }
  | { kind: 'satFatAboveFat' };

export type DraftResult =
  | { ok: true; input: FoodItemInput }
  | { ok: false; error: DraftError };

/** Turn the text draft into a `FoodItemInput`. Zod does the deeper validation. */
export function draftToInput(draft: IngredientDraft): DraftResult {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: { kind: 'nameRequired' } };

  const nutrients: Record<string, number> = {};
  for (const field of NUMERIC_NUTRIENT_FIELDS) {
    const parsed = parseDecimal(draft[field]);
    if (parsed === null) return { ok: false, error: { kind: 'notANumber', field } };
    if (parsed !== undefined) nutrients[field] = parsed;
  }

  const gi = parseDecimal(draft.glycemicIndex);
  if (gi === null) {
    return { ok: false, error: { kind: 'notANumber', field: 'glycemicIndex' } };
  }

  const portions: { label: string; grams: number }[] = [];
  for (const portion of draft.portions.slice(0, FOOD_PORTION_MAX)) {
    const label = portion.label.trim();
    const grams = parseDecimal(portion.grams);
    // A row left completely blank is simply dropped.
    if (!label && grams === undefined) continue;
    if (grams === null) return { ok: false, error: { kind: 'notANumber', field: 'grams' } };
    if (!label || grams === undefined) {
      return { ok: false, error: { kind: 'portionIncomplete' } };
    }
    portions.push({ label, grams });
  }

  // Zod enforces these too, but only in English. Checking here lets the message
  // be translated, and points at the field instead of failing on save.
  if (
    nutrients.sugarsG != null &&
    nutrients.carbsG != null &&
    nutrients.sugarsG > nutrients.carbsG + 0.01
  ) {
    return { ok: false, error: { kind: 'sugarsAboveCarbs' } };
  }
  if (
    nutrients.satFatG != null &&
    nutrients.fatG != null &&
    nutrients.satFatG > nutrients.fatG + 0.01
  ) {
    return { ok: false, error: { kind: 'satFatAboveFat' } };
  }

  const hasNutrients = Object.keys(nutrients).length > 0;
  const seasonMonths = [...draft.seasonMonths].sort((a, b) => a - b);
  const peakMonths = [...draft.peakMonths]
    .filter((month) => seasonMonths.includes(month))
    .sort((a, b) => a - b);
  const diversityKey = draft.diversityKey.trim().toLowerCase();

  return {
    ok: true,
    input: {
      name,
      group: draft.group,
      // Only persist the override when it disagrees with the group default.
      countsAsPlant:
        draft.countsAsPlant === isPlantFoodGroup(draft.group) ? undefined : draft.countsAsPlant,
      diversityKey: diversityKey || undefined,
      aliases: parseAliases(draft.aliases),
      seasonMonths: seasonMonths.length > 0 ? seasonMonths : undefined,
      peakMonths: peakMonths.length > 0 ? peakMonths : undefined,
      nutrients: hasNutrients
        ? {
            basis: draft.basis,
            ...(draft.state === 'none' ? {} : { state: draft.state }),
            ...nutrients,
          }
        : undefined,
      glycemicIndex: gi,
      portions: portions.length > 0 ? portions : undefined,
    },
  };
}
