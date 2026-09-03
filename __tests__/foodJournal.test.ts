/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { readAppSettings, writeAppSettings } from '../src/db/appSettingsBackup';
import { getDatabase } from '../src/db/client';
import { bumpDataGeneration, resetDataGenerationsForTests } from '../src/db/dataGeneration';
import { runMigrations } from '../src/db/migrations';
import * as notebookRepo from '../src/db/repositories/journalNotebookRepository';
import * as settingsRepo from '../src/db/repositories/settingsRepository';
import {
  createJournalNotebook,
  deleteJournalNotebook,
} from '../src/notes/journalNotebooks';
import {
  FOOD_JOURNAL_COLOR,
  FOOD_JOURNAL_ICON,
  readFoodJournalNotebookId,
  resolveFoodJournalNotebook,
  startFoodJournal,
} from '../src/nutrition/foodJournal';
import {
  APP_SETTING_KEYS,
  JOURNAL_NOTEBOOK_COLORS,
  JOURNAL_NOTEBOOK_MAX,
  TRACKER_ICON_IDS,
} from '../src/protocol';

/**
 * The food journal is a journal notebook the user opts into from Nutrition —
 * no new table, no new kind. Everything worth testing is about *not* creating
 * it: not on install, not on a read, not once the five-notebook budget is
 * spent, and not silently again after the user deleted it by hand.
 */

type Bind = null | number | string;

function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
    },
  } as unknown as SQLiteDatabase;
}

function notebookCount(raw: DatabaseSync): number {
  const row = raw.prepare('SELECT COUNT(*) AS n FROM journal_notebooks').get() as {
    n: number;
  };
  return row.n;
}

describe('food journal identity', () => {
  it('uses an icon from the shared tracker library', () => {
    expect(TRACKER_ICON_IDS).toContain(FOOD_JOURNAL_ICON);
  });

  it('uses a colour from the fixed notebook palette', () => {
    expect(JOURNAL_NOTEBOOK_COLORS).toContain(FOOD_JOURNAL_COLOR);
  });
});

describe('resolveFoodJournalNotebook', () => {
  const notebooks = [{ id: 'a' }, { id: 'b' }];

  it('resolves nothing when no notebook has been chosen', () => {
    expect(resolveFoodJournalNotebook(null, notebooks)).toBeNull();
    expect(resolveFoodJournalNotebook(undefined, notebooks)).toBeNull();
    expect(resolveFoodJournalNotebook('', notebooks)).toBeNull();
  });

  it('resolves the stored notebook when it is still there', () => {
    expect(resolveFoodJournalNotebook('b', notebooks)).toEqual({ id: 'b' });
  });

  it('resolves nothing when the stored notebook was deleted by hand', () => {
    expect(resolveFoodJournalNotebook('gone', notebooks)).toBeNull();
  });
});

describe('starting the food journal', () => {
  let raw: DatabaseSync;
  let db: SQLiteDatabase;

  beforeEach(async () => {
    resetDataGenerationsForTests();
    raw = new DatabaseSync(':memory:');
    db = wrap(raw);
    await runMigrations(db);
    (getDatabase as jest.Mock).mockResolvedValue(db);
  });

  afterEach(() => {
    raw.close();
  });

  it('does not exist until it is asked for', async () => {
    // Migrations seed the default notebook and nothing else.
    expect(notebookCount(raw)).toBe(1);
    await expect(readFoodJournalNotebookId()).resolves.toBeNull();
    expect(notebookCount(raw)).toBe(1);
  });

  it('creates one notebook on the first ask and stores the pointer', async () => {
    const result = await startFoodJournal();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(notebookCount(raw)).toBe(2);

    const created = await notebookRepo.getNotebook(db, result.notebookId);
    expect(created?.icon).toBe(FOOD_JOURNAL_ICON);
    expect(created?.color).toBe(FOOD_JOURNAL_COLOR);
    expect(created?.name.trim().length).toBeGreaterThan(0);

    await expect(readFoodJournalNotebookId()).resolves.toBe(result.notebookId);
    await expect(
      settingsRepo.getSetting(db, APP_SETTING_KEYS.foodJournalNotebookId),
    ).resolves.toBe(result.notebookId);
  });

  it('opens the same notebook on every later ask', async () => {
    const first = await startFoodJournal();
    const second = await startFoodJournal();

    expect(first).toEqual(second);
    expect(notebookCount(raw)).toBe(2);
  });

  it('fails gracefully at the five-notebook cap instead of throwing', async () => {
    // The default notebook plus four user ones fills the budget.
    for (let i = 0; i < JOURNAL_NOTEBOOK_MAX - 1; i += 1) {
      await createJournalNotebook({ name: `N${i}`, color: JOURNAL_NOTEBOOK_COLORS[1] });
    }
    expect(notebookCount(raw)).toBe(JOURNAL_NOTEBOOK_MAX);

    const result = await startFoodJournal();

    expect(result).toEqual({ status: 'atCap', max: JOURNAL_NOTEBOOK_MAX });
    expect(notebookCount(raw)).toBe(JOURNAL_NOTEBOOK_MAX);
    await expect(readFoodJournalNotebookId()).resolves.toBeNull();
  });

  it('goes quiet, not broken, once the user deletes the notebook by hand', async () => {
    const started = await startFoodJournal();
    if (started.status !== 'ok') throw new Error('expected a notebook');

    await deleteJournalNotebook(started.notebookId);

    // The pointer survives as a dangling id — reading must not resurrect it.
    const notebooks = await notebookRepo.getAllNotebooks(db);
    expect(notebooks.some((n) => n.id === started.notebookId)).toBe(false);
    expect(
      resolveFoodJournalNotebook(await readFoodJournalNotebookId(), notebooks),
    ).toBeNull();
    expect(notebookCount(raw)).toBe(1);
  });

  it('only comes back when the user asks for it again, as a fresh notebook', async () => {
    const started = await startFoodJournal();
    if (started.status !== 'ok') throw new Error('expected a notebook');
    await deleteJournalNotebook(started.notebookId);

    const restarted = await startFoodJournal();

    expect(restarted.status).toBe('ok');
    if (restarted.status !== 'ok') return;
    expect(restarted.notebookId).not.toBe(started.notebookId);
    await expect(readFoodJournalNotebookId()).resolves.toBe(restarted.notebookId);
    expect(notebookCount(raw)).toBe(2);
  });

  it('survives a backup round trip, so a restore offers no second food journal', async () => {
    const started = await startFoodJournal();
    if (started.status !== 'ok') throw new Error('expected a notebook');

    const settings = await readAppSettings(db);
    expect(settings.foodJournalNotebookId).toBe(started.notebookId);

    const restored = wrap(new DatabaseSync(':memory:'));
    await runMigrations(restored);
    await writeAppSettings(restored, settings);
    await expect(
      settingsRepo.getSetting(restored, APP_SETTING_KEYS.foodJournalNotebookId),
    ).resolves.toBe(started.notebookId);
  });

  it('abandons the write when a clear or import replaces journal data mid-flight', async () => {
    // The guard re-checks after every await; a clear landing between reading
    // the sort order and inserting must leave neither notebook nor pointer.
    const sortOrder = jest
      .spyOn(notebookRepo, 'nextSortOrder')
      .mockImplementation(async () => {
        bumpDataGeneration('journal');
        return 1;
      });

    const result = await startFoodJournal();

    expect(result).toEqual({ status: 'discarded' });
    expect(notebookCount(raw)).toBe(1);
    await expect(readFoodJournalNotebookId()).resolves.toBeNull();
    sortOrder.mockRestore();
  });
});
