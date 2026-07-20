import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import { getDatabase } from '../db/client';
import { newId } from '../utils/id';
import type { DashboardItem, ElementDefinition } from '../protocol';
import { PROTOCOL_VERSION } from '../protocol';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import { buildCounterConfig, type CounterConfig, type CounterInput } from '../protocol/kinds/counter';
import { buildHabitConfig, type HabitInput } from '../protocol/kinds/habit';
import { counterHandler } from '../kinds/registry';
import { prepareHabitTimerSoundForSave } from '../utils/habitTimerSoundSave';
import { stopHabitSound } from '../audio/habitTimerSound';
import {
  mergeKindOrderIntoDashboard,
  planHabitReorder,
  movePeersInOrder,
} from '../utils/reorderHabits';
import { getActiveCounters, getActiveHabits } from '../utils/dashboardElements';
import {
  abortHabitTimerRestore,
  awaitElementEventWrites,
  awaitHabitTimerStop,
  getEventDataEpoch,
  useEventStore,
} from './eventStore';
import { bumpWriteEpoch, clearWriteEpoch } from './writeEpoch';
import { withDbWriteLock } from '../db/writeLock';

let elementLoadGeneration = 0;

function invalidateElementLoads(): void {
  elementLoadGeneration += 1;
}

async function withGuardedElementWrite<T>(fn: () => Promise<T>): Promise<T> {
  const epochAtStart = getEventDataEpoch();
  return withDbWriteLock(async () => {
    if (epochAtStart !== getEventDataEpoch()) {
      throw new Error('Data was replaced; try again');
    }
    const result = await fn();
    if (epochAtStart !== getEventDataEpoch()) {
      throw new Error('Data was replaced; try again');
    }
    return result;
  });
}
async function persistKindOrder(
  kind: 'habit' | 'counter',
  nextKindOrder: string[],
  get: () => ElementState,
  set: (partial: Partial<ElementState>) => void,
): Promise<void> {
  const { elements, dashboard } = get();
  const { updates, nextDashboard } = mergeKindOrderIntoDashboard(
    dashboard,
    elements,
    kind,
    nextKindOrder,
  );
  if (updates.length === 0) return;

  await withGuardedElementWrite(async () => {
    const db = await getDatabase();
    await dashboardRepo.setDashboardSortOrders(db, updates);
    // Drop pins for elements archived while reorder was in flight.
    const activeIds = new Set(
      elements.filter((element) => element.archivedAt == null).map((element) => element.id),
    );
    invalidateElementLoads();
    set({
      dashboard: nextDashboard.filter((item) => activeIds.has(item.elementId)),
    });
  });
}

async function insertActiveElement(
  db: SQLiteDatabase,
  element: ElementDefinition,
): Promise<DashboardItem> {
  const dashboardItem: DashboardItem = {
    id: newId(),
    elementId: element.id,
    sortOrder: await dashboardRepo.getNextSortOrder(db),
  };
  await db.withTransactionAsync(async () => {
    await elementRepo.insertElement(db, element);
    await dashboardRepo.insertDashboardItem(db, dashboardItem);
  });
  return dashboardItem;
}

/** Stop in-memory timer + audio when that habit is leaving Home. */
async function clearHabitRuntime(elementId: string): Promise<void> {
  const hadSession = useEventStore.getState().activeTimerSessions[elementId] != null;
  abortHabitTimerRestore(elementId);
  useEventStore.getState().discardHabitTimer(elementId);
  await awaitHabitTimerStop(elementId);
  if (hadSession) {
    void stopHabitSound();
  }
}

/** Drop pins for archived elements; ensure every active element has a sort row. */
async function reconcileDashboardPlacements(
  db: SQLiteDatabase,
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): Promise<DashboardItem[]> {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const next = dashboard.filter((item) => {
    const element = byId.get(item.elementId);
    return element != null && element.archivedAt == null;
  });

  const stale = dashboard.filter((item) => !next.includes(item));
  for (const item of stale) {
    await dashboardRepo.deleteDashboardItem(db, item.id);
  }

  const placed = new Set(next.map((item) => item.elementId));
  let sortOrder = await dashboardRepo.getNextSortOrder(db);
  const added: DashboardItem[] = [];

  for (const element of elements) {
    if (element.archivedAt != null || placed.has(element.id)) continue;
    const item: DashboardItem = {
      id: newId(),
      elementId: element.id,
      sortOrder,
    };
    const inserted = await dashboardRepo.insertDashboardItemIfAbsent(db, item);
    if (inserted) {
      added.push(item);
      placed.add(element.id);
      sortOrder += 1;
    } else {
      // Another writer won the UNIQUE race — adopt the existing pin.
      const existing = (await dashboardRepo.getDashboardItems(db)).find(
        (row) => row.elementId === element.id,
      );
      if (existing && !placed.has(element.id)) {
        added.push(existing);
        placed.add(element.id);
      }
    }
  }

  return added.length === 0 ? next : [...next, ...added];
}

function applyElementMutation(
  set: (partial: Partial<ElementState>) => void,
  mutation: { elements: ElementDefinition[]; dashboard?: DashboardItem[] },
): void {
  set({
    elements: mutation.elements,
    ...(mutation.dashboard ? { dashboard: mutation.dashboard } : {}),
  });
}

interface ElementState {
  elements: ElementDefinition[];
  dashboard: DashboardItem[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  createCounter: (input: CounterInput) => Promise<void>;
  updateCounter: (id: string, input: CounterInput) => Promise<void>;
  createHabit: (input: HabitInput) => Promise<void>;
  updateHabit: (id: string, input: HabitInput) => Promise<void>;
  archiveElement: (elementId: string) => Promise<void>;
  restoreElement: (elementId: string) => Promise<void>;
  deleteElement: (id: string) => Promise<void>;
  /**
   * Move a habit in the Habits list. Uses the on-screen visible order so
   * chevrons match what the user sees.
   */
  reorderHabit: (
    habitId: string,
    direction: 'up' | 'down',
    visibleOrder: readonly string[],
  ) => Promise<void>;
  /** Move a counter up/down among counters; persists dashboard sort_order. */
  reorderCounter: (counterId: string, direction: 'up' | 'down') => Promise<void>;
}

export const useElementStore = create<ElementState>((set, get) => ({
  elements: [],
  dashboard: [],
  isLoading: false,
  error: null,

  load: async () => {
    const generation = ++elementLoadGeneration;
    set({ isLoading: true, error: null });
    try {
      await withDbWriteLock(async () => {
        if (generation !== elementLoadGeneration) return;
        const db = await getDatabase();
        // Sequential reads — concurrent prepareAsync can fail on shared SQLite.
        const elements = await elementRepo.getAllElements(db);
        const dashboardRows = await dashboardRepo.getDashboardItems(db);
        const dashboard = await reconcileDashboardPlacements(db, elements, dashboardRows);
        if (generation !== elementLoadGeneration) return;
        set({ elements, dashboard, isLoading: false });
      });
    } catch (error) {
      if (generation !== elementLoadGeneration) return;
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load elements',
      });
    }
  },

  createCounter: async (input) => {
    await withGuardedElementWrite(async () => {
      const db = await getDatabase();
      const config = buildCounterConfig(counterHandler.defaultConfig, input);

      const element: ElementDefinition = {
        id: newId(),
        kind: 'counter',
        name: input.name.trim(),
        config,
        protocolVersion: PROTOCOL_VERSION,
        createdAt: new Date().toISOString(),
        archivedAt: null,
      };

      const dashboardItem = await insertActiveElement(db, element);
      invalidateElementLoads();
      applyElementMutation(set, {
        elements: [...get().elements, element],
        dashboard: [...get().dashboard, dashboardItem],
      });
    });
  },

  updateCounter: async (id, input) => {
    await withGuardedElementWrite(async () => {
      const db = await getDatabase();
      const existing = get().elements.find((e) => e.id === id);
      if (!existing || existing.kind !== 'counter') {
        throw new Error('Counter element not found');
      }

      const config = buildCounterConfig(existing.config as Partial<CounterConfig>, input);

      await elementRepo.updateElement(
        db,
        id,
        {
          name: input.name.trim(),
          config,
        },
        'counter',
      );
      invalidateElementLoads();
      applyElementMutation(set, {
        elements: get().elements.map((element) =>
          element.id === id
            ? { ...element, name: input.name.trim(), config }
            : element,
        ),
      });
    });
  },

  createHabit: async (input) => {
    await withGuardedElementWrite(async () => {
      const db = await getDatabase();
      const id = newId();
      const timerSound = prepareHabitTimerSoundForSave(input.timerSound);
      const config = buildHabitConfig({ ...input, timerSound });

      const element: ElementDefinition = {
        id,
        kind: 'habit',
        name: input.name.trim(),
        config,
        protocolVersion: PROTOCOL_VERSION,
        createdAt: new Date().toISOString(),
        archivedAt: null,
      };

      const dashboardItem = await insertActiveElement(db, element);
      invalidateElementLoads();
      applyElementMutation(set, {
        elements: [...get().elements, element],
        dashboard: [...get().dashboard, dashboardItem],
      });
    });
  },

  updateHabit: async (id, input) => {
    await withGuardedElementWrite(async () => {
      const db = await getDatabase();
      const existing = get().elements.find((e) => e.id === id);
      if (!existing || existing.kind !== 'habit') {
        throw new Error('Habit not found');
      }

      const timerSound = prepareHabitTimerSoundForSave(input.timerSound);
      const config = buildHabitConfig({ ...input, timerSound });

      await elementRepo.updateElement(
        db,
        id,
        { name: input.name.trim(), config },
        'habit',
      );
      invalidateElementLoads();
      applyElementMutation(set, {
        elements: get().elements.map((element) =>
          element.id === id
            ? { ...element, name: input.name.trim(), config }
            : element,
        ),
      });
    });
  },

  archiveElement: async (elementId) => {
    const existing = get().elements.find((element) => element.id === elementId);
    if (!existing || existing.archivedAt != null) return;

    // Invalidate in-flight counter/toggle writes, then drain them before archive.
    bumpWriteEpoch(elementId);
    await awaitElementEventWrites(elementId);

    const archivedAt = new Date().toISOString();

    await withGuardedElementWrite(async () => {
      const db = await getDatabase();
      try {
        await db.withTransactionAsync(async () => {
          await elementRepo.setElementArchivedAt(db, elementId, archivedAt);
          await dashboardRepo.deleteDashboardItemForElement(db, elementId);
        });
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to archive element',
        );
      }
    });

    try {
      await clearHabitRuntime(elementId);
    } catch (error) {
      console.warn('Timer teardown after archive failed', error);
      abortHabitTimerRestore(elementId);
      useEventStore.getState().discardHabitTimer(elementId);
    }
    clearWriteEpoch(elementId);
    invalidateElementLoads();
    set({
      elements: get().elements.map((element) =>
        element.id === elementId ? { ...element, archivedAt } : element,
      ),
      dashboard: get().dashboard.filter((item) => item.elementId !== elementId),
    });
  },

  restoreElement: async (elementId) => {
    const existing = get().elements.find((element) => element.id === elementId);
    if (!existing || existing.archivedAt == null) return;

    let dashboardItem: DashboardItem | null = null;
    await withGuardedElementWrite(async () => {
      const db = await getDatabase();
      try {
        await db.withTransactionAsync(async () => {
          await elementRepo.setElementArchivedAt(db, elementId, null);
          const alreadyActive = await dashboardRepo.isElementOnDashboard(db, elementId);
          if (!alreadyActive) {
            dashboardItem = {
              id: newId(),
              elementId,
              sortOrder: await dashboardRepo.getNextSortOrder(db),
            };
            await dashboardRepo.insertDashboardItem(db, dashboardItem);
          } else {
            const existingPin = (await dashboardRepo.getDashboardItems(db)).find(
              (item) => item.elementId === elementId,
            );
            dashboardItem = existingPin ?? null;
          }
        });
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : 'Failed to restore element',
        );
      }
    });

    invalidateElementLoads();
    set({
      elements: get().elements.map((element) =>
        element.id === elementId ? { ...element, archivedAt: null } : element,
      ),
      dashboard: dashboardItem
        ? [
            ...get().dashboard.filter((item) => item.elementId !== elementId),
            dashboardItem,
          ]
        : get().dashboard,
    });
  },

  deleteElement: async (id) => {
    const existing = get().elements.find((e) => e.id === id);
    if (!existing) {
      throw new Error('Element not found');
    }
    bumpWriteEpoch(id);
    await awaitElementEventWrites(id);
    // Finalize/abort timer before CASCADE delete so stop can't rehydrate a ghost.
    await clearHabitRuntime(id);
    await withGuardedElementWrite(async () => {
      const db = await getDatabase();
      await elementRepo.deleteElement(db, id);
    });
    clearWriteEpoch(id);
    invalidateElementLoads();
    set({
      elements: get().elements.filter((element) => element.id !== id),
      dashboard: get().dashboard.filter((item) => item.elementId !== id),
    });
  },

  reorderHabit: async (habitId, direction, visibleOrder) => {
    const { elements, dashboard } = get();
    const habits = getActiveHabits(elements, dashboard);
    const target = habits.find((habit) => habit.id === habitId);
    if (!target) return;

    const nextHabitOrder = planHabitReorder({
      orderedHabitIds: habits.map((habit) => habit.id),
      visibleOrder,
      habitId,
      direction,
    });
    if (!nextHabitOrder) return;

    await persistKindOrder('habit', nextHabitOrder, get, set);
  },

  reorderCounter: async (counterId, direction) => {
    const { elements, dashboard } = get();
    const counters = getActiveCounters(elements, dashboard);
    const orderedIds = counters.map((counter) => counter.id);
    const nextCounterOrder = movePeersInOrder(
      orderedIds,
      orderedIds,
      counterId,
      direction,
    );
    if (!nextCounterOrder) return;

    await persistKindOrder('counter', nextCounterOrder, get, set);
  },
}));
