import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';
import { getDatabase } from '../db/client';
import { newId } from '../utils/id';
import type { DashboardItem, ElementDefinition, ElementKind } from '../protocol';
import { PROTOCOL_VERSION } from '../protocol';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import { buildCounterConfig, type CounterConfig, type CounterInput } from '../protocol/kinds/counter';
import { buildHabitConfig, type HabitInput } from '../protocol/kinds/habit';
import { counterHandler } from '../kinds/registry';
import { prepareHabitTimerSoundForSave } from '../utils/habitTimerSoundSave';

async function insertElementPinnedToDashboard(
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
  pinToDashboard: (elementId: string) => Promise<void>;
  unpinFromDashboard: (dashboardItemId: string) => Promise<void>;
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
      kind: 'counter' as ElementKind,
      name: input.name.trim(),
      config,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: new Date().toISOString(),
    };

    const dashboardItem = await insertElementPinnedToDashboard(db, element);
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
      kind: 'habit' as ElementKind,
      name: input.name.trim(),
      config,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: new Date().toISOString(),
    };

    const dashboardItem = await insertElementPinnedToDashboard(db, element);
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

  pinToDashboard: async (elementId) => {
    const db = await getDatabase();
    const alreadyPinned = await dashboardRepo.isElementOnDashboard(db, elementId);
    if (alreadyPinned) return;

    const dashboardItem: DashboardItem = {
      id: newId(),
      elementId,
      sortOrder: await dashboardRepo.getNextSortOrder(db),
    };
    await dashboardRepo.insertDashboardItem(db, dashboardItem);
    set({ dashboard: [...get().dashboard, dashboardItem] });
  },

  unpinFromDashboard: async (dashboardItemId) => {
    const db = await getDatabase();
    await dashboardRepo.deleteDashboardItem(db, dashboardItemId);
    set({
      dashboard: get().dashboard.filter((item) => item.id !== dashboardItemId),
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
