import {
  FOOD_GROUPS,
  isFoodInPeakSeason,
  isFoodInSeason,
  isPlantFood,
  type FoodGroup,
  type FoodItem,
} from '../protocol';

/** A catalog row paired with the name to show, already resolved for the language. */
export interface NamedFood {
  item: FoodItem;
  name: string;
}

export const FOOD_SORT_KEYS = ['name', 'group', 'season'] as const;
export type FoodSortKey = (typeof FOOD_SORT_KEYS)[number];

export interface FoodFilterState {
  /** `null` = every group. */
  group: FoodGroup | null;
  plantsOnly: boolean;
  inSeasonOnly: boolean;
}

export const DEFAULT_FOOD_FILTER: FoodFilterState = {
  group: null,
  plantsOnly: false,
  inSeasonOnly: false,
};

export function isFoodFilterActive(state: FoodFilterState): boolean {
  return state.group != null || state.plantsOnly || state.inSeasonOnly;
}

export function countActiveFoodFilters(state: FoodFilterState): number {
  let count = 0;
  if (state.group != null) count += 1;
  if (state.plantsOnly) count += 1;
  if (state.inSeasonOnly) count += 1;
  return count;
}

export interface FoodFilterContext {
  /** 1-based calendar month, for the in-season filter. */
  month: number;
}

export function filterFoods(
  entries: readonly NamedFood[],
  state: FoodFilterState,
  context: FoodFilterContext,
): NamedFood[] {
  return entries.filter(({ item }) => {
    if (state.group != null && item.group !== state.group) return false;
    if (state.plantsOnly && !isPlantFood(item)) return false;
    if (state.inSeasonOnly && !isFoodInSeason(item, context.month)) return false;
    return true;
  });
}

const GROUP_ORDER = new Map<FoodGroup, number>(
  FOOD_GROUPS.map((group, index) => [group, index]),
);

/** Peak first, then merely in season, then everything else. */
function seasonRank(item: FoodItem, month: number): number {
  if (isFoodInPeakSeason(item, month)) return 0;
  if (isFoodInSeason(item, month)) return 1;
  return 2;
}

/**
 * One collator per locale, built once and kept.
 *
 * `name.localeCompare(other, locale, options)` looks harmless but constructs a
 * fresh ICU collator on every call — about 17 ms each on the phone. A 200-food
 * catalog sorts in roughly 1 600 comparisons, which is the ten-second freeze
 * the Ingredients screen used to open with. See `foodSortCost.test.ts`.
 */
const collators = new Map<string, (a: string, b: string) => number>();

function nameCompare(locale: string | undefined): (a: string, b: string) => number {
  const key = locale ?? '';
  const cached = collators.get(key);
  if (cached) return cached;
  // Bare `localeCompare` is the fallback, not the fast path: without options it
  // skips the per-call collator, so it stays cheap on an engine with no Intl.
  const compare =
    typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
      ? new Intl.Collator(locale, { sensitivity: 'base' }).compare
      : (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase());
  collators.set(key, compare);
  return compare;
}

export function sortFoods(
  entries: readonly NamedFood[],
  sort: FoodSortKey,
  context: Pick<FoodFilterContext, 'month'>,
  /** BCP-47 tag so accented names order correctly in French. */
  locale?: string,
): NamedFood[] {
  const compareNames = nameCompare(locale);
  const byName = (a: NamedFood, b: NamedFood) => compareNames(a.name, b.name);

  const sorted = [...entries];
  if (sort === 'group') {
    sorted.sort((a, b) => {
      const diff =
        (GROUP_ORDER.get(a.item.group) ?? 0) - (GROUP_ORDER.get(b.item.group) ?? 0);
      return diff !== 0 ? diff : byName(a, b);
    });
    return sorted;
  }
  if (sort === 'season') {
    sorted.sort((a, b) => {
      const diff = seasonRank(a.item, context.month) - seasonRank(b.item, context.month);
      return diff !== 0 ? diff : byName(a, b);
    });
    return sorted;
  }
  sorted.sort(byName);
  return sorted;
}

/**
 * Whether the catalog already holds a food by this name, ignoring case.
 *
 * Checks both the resolved display names and the stored names, and the whole
 * catalog rather than the visible rows: a seed food shows "Carotte" but stores
 * "Carrot", and an active filter or an archived row can hide a food that
 * nonetheless exists. Offering to "add" one of those creates a duplicate.
 */
export function catalogHasFoodNamed(
  entries: readonly NamedFood[],
  items: readonly FoodItem[],
  name: string,
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return (
    entries.some((entry) => entry.name.toLowerCase() === needle) ||
    items.some((item) => item.name.toLowerCase() === needle)
  );
}
