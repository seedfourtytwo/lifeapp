import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { PROTOCOL_VERSION, toDateString } from '../protocol';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';

interface EventState {
  dailyTotals: Record<string, number>;
  isLogging: boolean;
  loadDailyTotals: (elementIds: string[], date?: string) => Promise<void>;
  logEvent: (
    elementId: string,
    value: number,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
}

function todayDate(): string {
  return toDateString(new Date());
}

export const useEventStore = create<EventState>((set, get) => ({
  dailyTotals: {},
  isLogging: false,

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

  logEvent: async (elementId, value, meta) => {
    set({ isLogging: true });
    try {
      const db = await getDatabase();
      const now = new Date();

      await eventRepo.insertEvent(db, {
        id: uuidv4(),
        elementId,
        timestamp: now.toISOString(),
        date: toDateString(now),
        value,
        meta,
        protocolVersion: PROTOCOL_VERSION,
      });

      const date = toDateString(now);
      const total = await eventRepo.getDailyTotal(db, elementId, date);
      set({
        dailyTotals: { ...get().dailyTotals, [elementId]: total },
        isLogging: false,
      });
    } catch {
      set({ isLogging: false });
      throw new Error('Failed to log event');
    }
  },
}));
