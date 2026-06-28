import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { DashboardItem, ElementDefinition, ElementKind, ElementCategory } from '../protocol';
import { PROTOCOL_VERSION } from '../protocol';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import { counterHandler } from '../kinds/registry';

interface ElementState {
  elements: ElementDefinition[];
  dashboard: DashboardItem[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  createCounter: (name: string, quickIncrements?: number[]) => Promise<void>;
  updateCounter: (id: string, name: string, quickIncrements: number[]) => Promise<void>;
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

  createCounter: async (name, quickIncrements) => {
    const db = await getDatabase();
    const element: ElementDefinition = {
      id: uuidv4(),
      kind: 'counter' as ElementKind,
      name: name.trim(),
      category: 'exercise' as ElementCategory,
      config: {
        ...counterHandler.defaultConfig,
        quickIncrements: quickIncrements ?? counterHandler.defaultConfig.quickIncrements,
      },
      protocolVersion: PROTOCOL_VERSION,
      createdAt: new Date().toISOString(),
    };

    await elementRepo.insertElement(db, element);
    await get().load();
  },

  updateCounter: async (id, name, quickIncrements) => {
    const db = await getDatabase();
    const existing = get().elements.find((e) => e.id === id);
    if (!existing || existing.kind !== 'counter') {
      throw new Error('Counter element not found');
    }

    await elementRepo.updateElement(
      db,
      id,
      {
        name: name.trim(),
        config: { ...existing.config, quickIncrements },
      },
      'counter',
    );
    await get().load();
  },

  pinToDashboard: async (elementId) => {
    const db = await getDatabase();
    const alreadyPinned = await dashboardRepo.isElementOnDashboard(db, elementId);
    if (alreadyPinned) return;

    const sortOrder = await dashboardRepo.getNextSortOrder(db);
    await dashboardRepo.insertDashboardItem(db, {
      id: uuidv4(),
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
