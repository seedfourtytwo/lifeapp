import { create } from 'zustand';
import { newId } from '../utils/id';
import { PROTOCOL_VERSION, toDateString } from '../protocol';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';

interface EventState {
  dailyTotals: Record<string, number>;
  habitDoneToday: Record<string, boolean>;
  loadDailyTotals: (elementIds: string[], date?: string) => Promise<void>;
  loadHabitCompletions: (elementIds: string[], date?: string) => Promise<void>;
  logEvent: (
    elementId: string,
    value: number,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
  undoLastEvent: (elementId: string, date?: string) => Promise<void>;
  setDailyTotal: (elementId: string, total: number, date?: string) => Promise<void>;
  toggleHabit: (elementId: string, date?: string) => Promise<void>;
}

function todayDate(): string {
  return toDateString(new Date());
}

async function refreshTotal(
  elementId: string,
  date: string,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): Promise<void> {
  const db = await getDatabase();
  const total = await eventRepo.getDailyTotal(db, elementId, date);
  set({ dailyTotals: { ...get().dailyTotals, [elementId]: total } });
}

export const useEventStore = create<EventState>((set, get) => ({
  dailyTotals: {},
  habitDoneToday: {},

  loadDailyTotals: async (elementIds, date = todayDate()) => {
    const db = await getDatabase();
    const totals: Record<string, number> = {};

    await Promise.all(
      elementIds.map(async (id) => {
        totals[id] = await eventRepo.getDailyTotal(db, id, date);
      }),
    );

    set({ dailyTotals: { ...get().dailyTotals, ...totals } });
  },

  loadHabitCompletions: async (elementIds, date = todayDate()) => {
    const db = await getDatabase();
    const completed = await eventRepo.getCompletedElementIdsOnDate(db, elementIds, date);
    const status: Record<string, boolean> = {};
    for (const id of elementIds) {
      status[id] = completed.has(id);
    }
    set({ habitDoneToday: { ...get().habitDoneToday, ...status } });
  },

  logEvent: async (elementId, value, meta) => {
    const db = await getDatabase();
    const now = new Date();
    const date = toDateString(now);

    await eventRepo.insertEvent(db, {
      id: newId(),
      elementId,
      timestamp: now.toISOString(),
      date,
      value,
      meta,
      protocolVersion: PROTOCOL_VERSION,
    });

    await refreshTotal(elementId, date, set, get);
  },

  undoLastEvent: async (elementId, date = todayDate()) => {
    const db = await getDatabase();
    const last = await eventRepo.getLastEventForElementOnDate(db, elementId, date);
    if (!last) return;

    await eventRepo.deleteEventById(db, last.id);
    await refreshTotal(elementId, date, set, get);
  },

  setDailyTotal: async (elementId, total, date = todayDate()) => {
    if (total < 0 || !Number.isFinite(total)) {
      throw new Error('Total must be a non-negative number');
    }

    const db = await getDatabase();
    await eventRepo.deleteEventsForElementOnDate(db, elementId, date);

    if (total > 0) {
      const now = new Date();
      await eventRepo.insertEvent(db, {
        id: newId(),
        elementId,
        timestamp: now.toISOString(),
        date,
        value: total,
        meta: { source: 'manual_set' },
        protocolVersion: PROTOCOL_VERSION,
      });
    }

    await refreshTotal(elementId, date, set, get);
  },

  toggleHabit: async (elementId, date = todayDate()) => {
    const db = await getDatabase();
    const done = get().habitDoneToday[elementId] ?? false;

    if (done) {
      await eventRepo.deleteEventsForElementOnDate(db, elementId, date);
    } else {
      const now = new Date();
      await eventRepo.insertEvent(db, {
        id: newId(),
        elementId,
        timestamp: now.toISOString(),
        date,
        value: 1,
        meta: { source: 'habit_tick' },
        protocolVersion: PROTOCOL_VERSION,
      });
    }

    set({
      habitDoneToday: { ...get().habitDoneToday, [elementId]: !done },
    });
  },
}));
