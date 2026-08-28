import type { SQLiteDatabase } from 'expo-sqlite';
import {
  PERSISTED_CONCEPTS,
  persistedConcept,
  type PersistedConcept,
  type PersistedConceptName,
} from './persistedConcepts';

/**
 * The idempotent repair pass. Every concept gets the same treatment — rebuild
 * what a `CREATE TABLE IF NOT EXISTS` would mask, run its DDL, then apply the
 * repairs a create cannot express — so a new concept is repaired the moment it
 * is declared, with nothing to remember here.
 */
async function repairConcept(db: SQLiteDatabase, concept: PersistedConcept): Promise<void> {
  await concept.rebuild?.(db);
  await db.execAsync(concept.ddl);
  await concept.repair?.(db);
}

async function repairConcepts(
  db: SQLiteDatabase,
  names: readonly PersistedConceptName[],
): Promise<void> {
  for (const name of names) {
    await repairConcept(db, persistedConcept(name));
  }
}

/**
 * Boot-path entry point: every concept's repair, in declaration order.
 * Sequential — order matters (parents before children, notebooks before the
 * journals that reference them) and concurrent DDL on expo-sqlite is unsafe.
 */
export async function ensureSchemaIntegrity(db: SQLiteDatabase): Promise<void> {
  for (const concept of PERSISTED_CONCEPTS) {
    await repairConcept(db, concept);
  }
}

/*
 * Named wrappers below exist because frozen numbered migrations call them one
 * concept at a time. They are not the boot path — do not add callers.
 */

export async function ensureElementsSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['elements']);
}

export async function ensureWeatherDailySchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['weather']);
}

export async function ensureCalendarSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['calendar']);
}

export async function ensureDayNotesSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['dayNotes']);
}

export async function ensureJournalNotebooksSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['journalNotebooks']);
}

/** Journals reference notebooks, and the pre-v16 rebuild needs one to exist. */
export async function ensureDailyJournalsSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['journalNotebooks', 'dailyJournals']);
}

export async function ensureNoteShareStateSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['noteShareState']);
}

export async function ensureFoodSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['foodItems', 'foodLog']);
}

export async function ensureTodoSchema(db: SQLiteDatabase): Promise<void> {
  await repairConcepts(db, ['todos']);
}
