import { create } from 'zustand';
import { getDatabase } from '../db/client';
import * as foodRepo from '../db/repositories/foodRepository';
import {
  createFoodItem,
  removeFoodItem,
  restoreFoodItem,
  setFoodLogged,
  updateFoodItem,
  type FoodItemInput,
  type RemoveFoodResult,
} from '../nutrition/foodCatalog';
import { syncSeedFoodCatalog } from '../nutrition/seedCatalog';
import { PROTOCOL_VERSION, type FoodItem, type FoodLogEntry } from '../protocol';
import { startOfWeekDate, weekDates } from '../utils/dates';
import { newId } from '../utils/id';

let loadGeneration = 0;

interface FoodState {
  /**
   * The whole catalog, archived foods included. Diversity counting needs them —
   * a food archived mid-week was still eaten — so screens filter for display
   * rather than the store filtering on load.
   */
  items: FoodItem[];
  /** Log entries for `weekStart`'s Mon–Sun week only — not the whole history. */
  weekEntries: FoodLogEntry[];
  /** Monday of the loaded week, or null before the first load. */
  weekStart: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  /** Load the week containing `date`; no-op when that week is already loaded. */
  loadWeek: (date: string) => Promise<void>;
  /** Force a refetch of the catalog and the loaded week. */
  reload: () => Promise<void>;
  /** Refetch only the day log — no catalog re-read, for logging taps. */
  reloadLog: () => Promise<void>;
  toggleLogged: (input: { foodId: string; date: string; logged: boolean }) => Promise<void>;
  /** Catalog writes resolve to undefined when a clear/import discarded them. */
  create: (input: FoodItemInput) => Promise<FoodItem | undefined>;
  update: (id: string, input: FoodItemInput) => Promise<void>;
  remove: (id: string) => Promise<RemoveFoodResult | undefined>;
  restore: (id: string) => Promise<void>;
}

async function fetchWeek(weekStart: string): Promise<{
  items: FoodItem[];
  weekEntries: FoodLogEntry[];
}> {
  const db = await getDatabase();
  // Sequential reads — concurrent prepareAsync can fail on shared SQLite.
  const items = await foodRepo.getAllFoodItems(db);
  const weekEntries = await foodRepo.getFoodLogForDates(db, weekDates(weekStart));
  return { items, weekEntries };
}

export const useFoodStore = create<FoodState>((set, get) => ({
  items: [],
  weekEntries: [],
  weekStart: null,
  loaded: false,
  loading: false,
  error: null,

  loadWeek: async (date) => {
    const weekStart = startOfWeekDate(date);
    const state = get();
    if (state.weekStart === weekStart && (state.loaded || state.loading)) return;

    const generation = ++loadGeneration;
    set({ loading: true, weekStart });
    try {
      await syncSeedFoodCatalog();
      const next = await fetchWeek(weekStart);
      if (generation !== loadGeneration) return;
      set({ ...next, loaded: true, loading: false, error: null });
    } catch (error) {
      if (generation !== loadGeneration) return;
      console.warn('Failed to load food catalog', error);
      set({ loading: false, error: 'load' });
    }
  },

  reloadLog: async () => {
    const weekStart = get().weekStart;
    if (!weekStart) return;
    try {
      const db = await getDatabase();
      const weekEntries = await foodRepo.getFoodLogForDates(db, weekDates(weekStart));
      // No generation guard: this races only with itself, and the last write wins
      // either way. A full `reload` in flight will overwrite this with fresher data.
      if (get().weekStart !== weekStart) return;
      set({ weekEntries });
    } catch (error) {
      console.warn('Failed to reload food log', error);
    }
  },

  reload: async () => {
    const weekStart = get().weekStart;
    if (!weekStart) return;
    const generation = ++loadGeneration;
    set({ loading: true });
    try {
      const next = await fetchWeek(weekStart);
      if (generation !== loadGeneration) return;
      set({ ...next, loaded: true, loading: false, error: null });
    } catch (error) {
      if (generation !== loadGeneration) return;
      // Non-fatal — the screen keeps the last known week until the next reload.
      console.warn('Failed to reload food catalog', error);
      set({ loading: false });
    }
  },

  toggleLogged: async ({ foodId, date, logged }) => {
    const matches = (entry: FoodLogEntry) => entry.foodId === foodId && entry.date === date;
    // Optimistic so the tap feels instant. Applied as a function of current
    // state, not a captured snapshot, so rapid taps on different foods do not
    // clobber each other.
    set((state) => ({
      weekEntries: logged
        ? state.weekEntries.some(matches)
          ? state.weekEntries
          : [
              ...state.weekEntries,
              {
                // A real id: nothing parses these today, but a fake one would
                // fail FoodLogEntrySchema the day something does.
                id: newId(),
                foodId,
                date,
                loggedAt: new Date().toISOString(),
                protocolVersion: PROTOCOL_VERSION,
              },
            ]
        : state.weekEntries.filter((entry) => !matches(entry)),
    }));

    try {
      await setFoodLogged({ foodId, date, logged });
    } catch (error) {
      console.warn('Failed to update food log', error);
      // Undo just this change; other taps in flight keep theirs.
      set((state) => ({
        weekEntries: logged
          ? state.weekEntries.filter((entry) => !matches(entry))
          : state.weekEntries,
      }));
      if (!logged) await get().reloadLog();
      return;
    }
    // Only the log changed — re-reading the whole catalog on every tap is waste.
    await get().reloadLog();
  },

  create: async (input) => {
    const item = await createFoodItem(input);
    await get().reload();
    return item;
  },

  update: async (id, input) => {
    await updateFoodItem(id, input);
    await get().reload();
  },

  remove: async (id) => {
    const result = await removeFoodItem(id);
    await get().reload();
    return result;
  },

  restore: async (id) => {
    await restoreFoodItem(id);
    await get().reload();
  },
}));

/** Catalog rows to show in lists — archived foods stay out of the way. */
export function activeFoodItems(items: readonly FoodItem[]): FoodItem[] {
  return items.filter((item) => item.archivedAt == null);
}
