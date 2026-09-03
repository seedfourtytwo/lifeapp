import { getDatabase } from '../db/client';
import { withGuardedWrite } from '../db/dataGeneration';
import * as notebookRepo from '../db/repositories/journalNotebookRepository';
import * as settingsRepo from '../db/repositories/settingsRepository';
import { i18n } from '../i18n';
import { createJournalNotebook } from '../notes/journalNotebooks';
import {
  APP_SETTING_KEYS,
  JOURNAL_NOTEBOOK_MAX,
  type JournalNotebookColor,
  type TrackerIconId,
} from '../protocol';

/**
 * Free-text journalling about food, reachable from the Nutrition tab.
 *
 * This is a plain journal notebook — not a table, not a kind, not a catalog.
 * A notebook day already holds as many chapters as you write, so the whole
 * feature is one pointer saying *which* notebook Nutrition writes into.
 *
 * Keep it apart from the food **log** (`food_log`): that is structured catalog
 * ticks driving the weekly plant count. This is prose about eating.
 *
 * Notebooks are capped at five, so a food journal costs the user a fifth of
 * their budget. It is therefore never created on install, on migration, or on
 * opening Nutrition — only when someone taps the affordance.
 */

/** Fork and knife, from the shared tracker icon library. */
export const FOOD_JOURNAL_ICON: TrackerIconId = 'silverware-fork-knife';

/** Green, from the fixed eight-colour notebook palette. */
export const FOOD_JOURNAL_COLOR: JournalNotebookColor = '#16A34A';

export type FoodJournalStart =
  /** The notebook to open — freshly created, or the one already on file. */
  | { status: 'ok'; notebookId: string }
  /** Every notebook slot is spoken for; nothing was created. */
  | { status: 'atCap'; max: number }
  /** A backup import or Clear data replaced journal rows mid-write. */
  | { status: 'discarded' };

/**
 * The notebook the stored id names, or null when there is no food journal.
 *
 * Null covers both "never started one" and "started one, then deleted it from
 * the notebook manager" — the id is left dangling rather than chased, so a
 * deleted food journal simply stops being one. Nothing resurrects it.
 */
export function resolveFoodJournalNotebook<T extends { id: string }>(
  storedId: string | null | undefined,
  notebooks: readonly T[],
): T | null {
  if (!storedId) return null;
  return notebooks.find((notebook) => notebook.id === storedId) ?? null;
}

/** Reads the pointer. Never creates anything. */
export async function readFoodJournalNotebookId(): Promise<string | null> {
  const db = await getDatabase();
  return settingsRepo.getSetting(db, APP_SETTING_KEYS.foodJournalNotebookId);
}

/**
 * What the Nutrition affordance calls: hand back the food journal, creating it
 * the first time and after the user deleted it and asked again.
 */
export async function startFoodJournal(): Promise<FoodJournalStart> {
  const db = await getDatabase();
  const storedId = await settingsRepo.getSetting(
    db,
    APP_SETTING_KEYS.foodJournalNotebookId,
  );
  const notebooks = await notebookRepo.getAllNotebooks(db);

  const existing = resolveFoodJournalNotebook(storedId, notebooks);
  if (existing) return { status: 'ok', notebookId: existing.id };

  if (notebooks.length >= JOURNAL_NOTEBOOK_MAX) {
    return { status: 'atCap', max: JOURNAL_NOTEBOOK_MAX };
  }

  // The count above was read outside the write lock, so the cap is re-checked
  // inside `createJournalNotebook` — where it throws rather than returns.
  let created;
  try {
    created = await createJournalNotebook({
      name: i18n.t('nutrition:foodJournal.notebookName'),
      color: FOOD_JOURNAL_COLOR,
      icon: FOOD_JOURNAL_ICON,
    });
  } catch {
    return { status: 'atCap', max: JOURNAL_NOTEBOOK_MAX };
  }
  // Undefined means a clear or import took the write; the notebook is not there.
  if (!created) return { status: 'discarded' };

  const linked = await withGuardedWrite('journal', async ({ superseded }) => {
    const writeDb = await getDatabase();
    if (superseded()) return false;
    await settingsRepo.setSetting(
      writeDb,
      APP_SETTING_KEYS.foodJournalNotebookId,
      created.id,
    );
    return true;
  });
  if (!linked) return { status: 'discarded' };

  return { status: 'ok', notebookId: created.id };
}
