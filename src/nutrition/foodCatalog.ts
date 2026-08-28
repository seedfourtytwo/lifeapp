import {
  FoodItemSchema,
  PROTOCOL_VERSION,
  type FoodGroup,
  type FoodItem,
  type FoodNutrientsInput,
  type FoodPortion,
} from '../protocol';
import { getDatabase } from '../db/client';
import { withGuardedWrite } from '../db/dataGeneration';
import * as foodRepo from '../db/repositories/foodRepository';
import { newId } from '../utils/id';

export interface FoodItemInput {
  name: string;
  group: FoodGroup;
  countsAsPlant?: boolean;
  diversityKey?: string;
  aliases?: string[];
  seasonMonths?: number[];
  peakMonths?: number[];
  nutrients?: FoodNutrientsInput;
  glycemicIndex?: number;
  portions?: FoodPortion[];
}

/** All catalog writes resolve to undefined when a clear/import discarded them. */
export async function createFoodItem(input: FoodItemInput): Promise<FoodItem | undefined> {
  return withGuardedWrite('catalog', async ({ superseded }) => {
    const db = await getDatabase();
    const item = FoodItemSchema.parse({
      id: newId(),
      name: input.name,
      group: input.group,
      countsAsPlant: input.countsAsPlant,
      diversityKey: input.diversityKey,
      aliases: input.aliases,
      seasonMonths: input.seasonMonths,
      peakMonths: input.peakMonths,
      nutrients: input.nutrients,
      glycemicIndex: input.glycemicIndex,
      portions: input.portions,
      createdAt: new Date().toISOString(),
      archivedAt: null,
      protocolVersion: PROTOCOL_VERSION,
    });
    if (superseded()) return undefined;
    await foodRepo.insertFoodItem(db, item);
    return item;
  });
}

export async function updateFoodItem(
  id: string,
  input: FoodItemInput,
): Promise<FoodItem | null | undefined> {
  return withGuardedWrite('catalog', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return undefined;
    return foodRepo.updateFoodItem(db, id, input);
  });
}

export async function restoreFoodItem(id: string): Promise<void> {
  await withGuardedWrite('catalog', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return;
    await foodRepo.setFoodItemArchivedAt(db, id, null);
  });
}

export type RemoveFoodResult = 'deleted' | 'archived';

/**
 * Remove a food from the catalog. Foods that were never eaten are deleted
 * outright; foods with log history are archived so past weeks keep their counts
 * (a hard delete would cascade the log rows away).
 */
export async function removeFoodItem(id: string): Promise<RemoveFoodResult | undefined> {
  return withGuardedWrite('catalog', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return undefined;
    const logged = await foodRepo.countFoodLogEntriesForFood(db, id);
    // The count decided which branch to take; a clear since then invalidates it.
    if (superseded()) return undefined;
    if (logged > 0) {
      await foodRepo.setFoodItemArchivedAt(db, id, new Date().toISOString());
      return 'archived';
    }
    await foodRepo.deleteFoodItem(db, id);
    return 'deleted';
  });
}

export async function setFoodLogged(input: {
  foodId: string;
  date: string;
  logged: boolean;
}): Promise<void> {
  await withGuardedWrite('catalog', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return;
    if (input.logged) {
      await foodRepo.addFoodLogEntry(db, { foodId: input.foodId, date: input.date });
      return;
    }
    await foodRepo.removeFoodLogEntry(db, { foodId: input.foodId, date: input.date });
  });
}
