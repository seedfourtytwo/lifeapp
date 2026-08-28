import type { SQLiteDatabase } from 'expo-sqlite';
import * as settingsRepo from '../db/repositories/settingsRepository';

/**
 * Which starter-food slugs this device has already applied.
 *
 * Split out of `seedCatalog.ts` so the food catalog's clear semantics can be
 * declared in `src/db/persistedConcepts.ts` without dragging `getDatabase` —
 * and therefore the whole schema module graph — into a cycle.
 */
export const SEED_APPLIED_SLUGS_KEY = 'food_seed_applied_slugs';

/**
 * Forget which seed slugs were applied, so the starter foods return on the next
 * sync. Called when the food catalog itself is wiped — a clean slate should not
 * leave an empty catalog with no way back.
 */
export async function clearSeedFoodState(db: SQLiteDatabase): Promise<void> {
  await settingsRepo.deleteSetting(db, SEED_APPLIED_SLUGS_KEY);
}
