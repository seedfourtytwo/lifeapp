import {
  WEEKLY_PLANT_TARGET,
  foodDiversityKey,
  isPlantFood,
  type FoodItem,
  type FoodLogEntry,
} from '../protocol';

export interface WeekDiversity {
  /**
   * Distinct plants logged in the week — the number the target is about.
   * Counted by diversity key, so two varieties of the same plant count once.
   */
  plantCount: number;
  /** Distinct foods of any group, plants included. Counted the same way. */
  totalCount: number;
  target: number;
  /** Still needed to reach the target; 0 once met. */
  remaining: number;
  /** 0–1, clamped — safe to hand straight to a progress bar. */
  progress: number;
  /** Ids of the distinct plants logged, for highlighting rows in the list. */
  plantFoodIds: Set<string>;
  /** Ids of every distinct food logged in the week. */
  loggedFoodIds: Set<string>;
}

/**
 * Distinct-food counts for one week. `entries` should already be scoped to the
 * week's dates; foods missing from `items` (deleted mid-week) are ignored.
 */
export function computeWeekDiversity(
  items: readonly FoodItem[],
  entries: readonly FoodLogEntry[],
  target: number = WEEKLY_PLANT_TARGET,
): WeekDiversity {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const plantFoodIds = new Set<string>();
  const loggedFoodIds = new Set<string>();
  // Counting is by diversity key; the id sets exist for highlighting rows.
  const plantKeys = new Set<string>();
  const loggedKeys = new Set<string>();

  for (const entry of entries) {
    const item = itemsById.get(entry.foodId);
    if (!item) continue;
    loggedFoodIds.add(item.id);
    loggedKeys.add(foodDiversityKey(item));
    if (isPlantFood(item)) {
      plantFoodIds.add(item.id);
      plantKeys.add(foodDiversityKey(item));
    }
  }

  const plantCount = plantKeys.size;
  return {
    plantCount,
    totalCount: loggedKeys.size,
    target,
    remaining: Math.max(0, target - plantCount),
    progress: target > 0 ? Math.min(1, plantCount / target) : 0,
    plantFoodIds,
    loggedFoodIds,
  };
}

/** Food ids logged on one specific date. */
export function loggedFoodIdsForDate(
  entries: readonly FoodLogEntry[],
  date: string,
): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.date === date) ids.add(entry.foodId);
  }
  return ids;
}
