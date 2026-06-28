import { create } from 'zustand';
import { newId } from '../utils/id';
import type { DashboardItem, ElementDefinition, ElementKind, ElementCategory } from '../protocol';
import { PROTOCOL_VERSION } from '../protocol';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import { buildCounterConfig, type CounterConfig, type CounterInput } from '../protocol/kinds/counter';
import { buildHabitConfig, type HabitInput } from '../protocol/kinds/habit';
import { counterHandler } from '../kinds/registry';

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
      category: 'exercise' as ElementCategory,
      config,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: new Date().toISOString(),
    };

    await elementRepo.insertElement(db, element);
    await get().load();
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
    await get().load();
  },

  createHabit: async (input) => {
    const db = await getDatabase();
    const config = buildHabitConfig(input);

    const element: ElementDefinition = {
      id: newId(),
      kind: 'habit' as ElementKind,
      name: input.name.trim(),
      category: 'habit' as ElementCategory,
      config,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: new Date().toISOString(),
    };

    await elementRepo.insertElement(db, element);
    await get().load();
  },

  updateHabit: async (id, input) => {
    const db = await getDatabase();
    const existing = get().elements.find((e) => e.id === id);
    if (!existing || existing.kind !== 'habit') {
      throw new Error('Habit not found');
    }

    const config = buildHabitConfig(input);

    await elementRepo.updateElement(
      db,
      id,
      { name: input.name.trim(), config },
      'habit',
    );
    await get().load();
  },

  pinToDashboard: async (elementId) => {
    const db = await getDatabase();
    const alreadyPinned = await dashboardRepo.isElementOnDashboard(db, elementId);
    if (alreadyPinned) return;

    const sortOrder = await dashboardRepo.getNextSortOrder(db);
    await dashboardRepo.insertDashboardItem(db, {
      id: newId(),
      elementId,
      sortOrder,
    });
    await get().load();
  },

  unpinFromDashboard: async (dashboardItemId) => {
    const db = await getDatabase();
    await dashboardRepo.deleteDashboardItem(db, dashboardItemId);
    await get().load();
  },
}));
