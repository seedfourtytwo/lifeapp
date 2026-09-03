import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as notebookRepo from '../db/repositories/journalNotebookRepository';
import {
  createJournalNotebook,
  deleteJournalNotebook,
  moveJournalNotebook,
  updateJournalNotebook,
} from '../notes/journalNotebooks';
import { startFoodJournal, type FoodJournalStart } from '../nutrition/foodJournal';
import type { JournalNotebook, JournalNotebookColor, TrackerIconId } from '../protocol';

let loadGeneration = 0;

interface JournalNotebookState {
  notebooks: JournalNotebook[];
  loaded: boolean;
  loading: boolean;
  /** Fetch once; safe to call from every screen that needs the list. */
  load: () => Promise<void>;
  /** Force a refetch — call after a mutation made outside this store. */
  reload: () => Promise<void>;
  /** Resolves to undefined when a clear/import discarded the write. */
  create: (input: {
    name: string;
    color: JournalNotebookColor;
    icon?: TrackerIconId;
  }) => Promise<JournalNotebook | undefined>;
  update: (
    id: string,
    patch: { name: string; color: JournalNotebookColor; icon?: TrackerIconId },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  move: (id: string, direction: 'up' | 'down') => Promise<void>;
  /**
   * Nutrition's opt-in food journal. Creates the notebook the first time and
   * hands back the one already on file afterwards; never throws at the cap.
   */
  startFoodJournal: () => Promise<FoodJournalStart>;
}

export const useJournalNotebookStore = create<JournalNotebookState>((set, get) => ({
  notebooks: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded || get().loading) return;
    await get().reload();
  },

  reload: async () => {
    const generation = ++loadGeneration;
    set({ loading: true });
    try {
      const db = await getDatabase();
      const notebooks = await notebookRepo.getAllNotebooks(db);
      if (generation !== loadGeneration) return;
      set({ notebooks, loaded: true, loading: false });
    } catch (error) {
      if (generation !== loadGeneration) return;
      // Non-fatal — screens keep the last known list until the next reload.
      console.warn('Failed to load journal notebooks', error);
      set({ loading: false });
    }
  },

  create: async (input) => {
    const notebook = await createJournalNotebook(input);
    await get().reload();
    return notebook;
  },

  update: async (id, patch) => {
    await updateJournalNotebook(id, patch);
    await get().reload();
  },

  remove: async (id) => {
    await deleteJournalNotebook(id);
    await get().reload();
  },

  move: async (id, direction) => {
    await moveJournalNotebook(id, direction);
    await get().reload();
  },

  startFoodJournal: async () => {
    const result = await startFoodJournal();
    if (result.status === 'ok') await get().reload();
    return result;
  },
}));
