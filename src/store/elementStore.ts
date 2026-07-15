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

async function insertActiveElement(
  db: SQLiteDatabase,
  element: ElementDefinition,
): Promise<DashboardItem> {
  const dashboardItem: DashboardItem = {
    id: newId(),
    elementId: element.id,
    sortOrder: await dashboardRepo.getNextSortOrder(db),
  };
  await elementRepo.insertElement(db, element);
  await dashboardRepo.insertDashboardItem(db, dashboardItem);
  return dashboardItem;
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
}

export const useElementStore = create<ElementState>((set, get) => ({
  elements: [],
  dashboard: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const [elements, dashboard] = await Promise.all([
        elementRepo.getAllElements(db),
        dashboardRepo.getDashboardItems(db),
      ]);
      set({ elements, dashboard, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load elements',
      });
    }
  },

  createCounter: async (input) => {
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
    applyElementMutation(set, {
      elements: [...get().elements, element],
      dashboard: [...get().dashboard, dashboardItem],
    });
  },

  updateCounter: async (id, input) => {
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
    applyElementMutation(set, {
      elements: get().elements.map((element) =>
        element.id === id
          ? { ...element, name: input.name.trim(), config }
          : element,
      ),
    });
  },

  createHabit: async (input) => {
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
    applyElementMutation(set, {
      elements: [...get().elements, element],
      dashboard: [...get().dashboard, dashboardItem],
    });
  },

  updateHabit: async (id, input) => {
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
    applyElementMutation(set, {
      elements: get().elements.map((element) =>
        element.id === id
          ? { ...element, name: input.name.trim(), config }
          : element,
      ),
    });
  },

  archiveElement: async (elementId) => {
    const db = await getDatabase();
    const existing = get().elements.find((element) => element.id === elementId);
    if (!existing || existing.archivedAt != null) return;

    const archivedAt = new Date().toISOString();
    const dashboardItem = get().dashboard.find((item) => item.elementId === elementId);

    try {
      await db.withTransactionAsync(async () => {
        await elementRepo.setElementArchivedAt(db, elementId, archivedAt);
        if (dashboardItem) {
          await dashboardRepo.deleteDashboardItem(db, dashboardItem.id);
        }
      });
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to archive element',
      );
    }

    set({
      elements: get().elements.map((element) =>
        element.id === elementId ? { ...element, archivedAt } : element,
      ),
      dashboard: get().dashboard.filter((item) => item.elementId !== elementId),
    });
  },

  restoreElement: async (elementId) => {
    const db = await getDatabase();
    const existing = get().elements.find((element) => element.id === elementId);
    if (!existing || existing.archivedAt == null) return;

    let dashboardItem: DashboardItem | null = null;
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
        }
      });
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to restore element',
      );
    }

    set({
      elements: get().elements.map((element) =>
        element.id === elementId ? { ...element, archivedAt: null } : element,
      ),
      dashboard: dashboardItem
        ? [...get().dashboard, dashboardItem]
        : get().dashboard,
    });
  },

  deleteElement: async (id) => {
    const db = await getDatabase();
    const existing = get().elements.find((e) => e.id === id);
    if (!existing) {
      throw new Error('Element not found');
    }
    await elementRepo.deleteElement(db, id);
    set({
      elements: get().elements.filter((element) => element.id !== id),
      dashboard: get().dashboard.filter((item) => item.elementId !== id),
    });
  },
}));
