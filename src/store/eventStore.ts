import { create } from 'zustand';
import { newId } from '../utils/id';
import {
  buildTimerSessionPayload,
  HabitConfigSchema,
  isHabitDayComplete,
  isHabitScheduledOnDate,
  PROTOCOL_VERSION,
  toDateString,
  type HabitConfig,
} from '../protocol';
import { dateDaysAgo } from '../utils/dates';
import { completedDatesFromDailyTotals, computeStreak } from '../utils/streak';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';

export interface HabitStreakInput {
  id: string;
  config: HabitConfig;
}

interface ActiveTimerSession {
  startedAt: string;
}

interface EventState {
  dailyTotals: Record<string, number>;
  yesterdayTotals: Record<string, number>;
  habitDoneToday: Record<string, boolean>;
  habitStreaks: Record<string, number>;
  activeTimerSessions: Record<string, ActiveTimerSession>;
  loadDailyTotals: (elementIds: string[], date?: string) => Promise<void>;
  loadCounterTotals: (elementIds: string[]) => Promise<void>;
  loadHabitDayState: (habits: HabitStreakInput[], date?: string) => Promise<void>;
  loadHabitStreaks: (habits: HabitStreakInput[]) => Promise<void>;
  logEvent: (
    elementId: string,
    value: number,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
  setDailyTotal: (elementId: string, total: number, date?: string) => Promise<void>;
  toggleHabit: (elementId: string, config: HabitConfig, date?: string) => Promise<void>;
  startHabitTimer: (elementId: string) => void;
  stopHabitTimer: (elementId: string, config: HabitConfig, date?: string) => Promise<void>;
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

async function computeHabitStreak(
  elementId: string,
  config: HabitConfig,
): Promise<number> {
  const db = await getDatabase();
  const since = dateDaysAgo(365);
  const rows = await eventRepo.getDailyTotalsByElement(db, elementId, since);
  const completed = completedDatesFromDailyTotals(rows, (total) =>
    isHabitDayComplete(total, config),
  );
  return computeStreak(
    completed,
    todayDate(),
    (date) => isHabitScheduledOnDate(config, date),
  );
}

async function refreshHabitStatus(
  elementId: string,
  config: HabitConfig,
  date: string,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): Promise<void> {
  const db = await getDatabase();
  const total = await eventRepo.getDailyTotal(db, elementId, date);
  set({
    dailyTotals: { ...get().dailyTotals, [elementId]: total },
    habitDoneToday: {
      ...get().habitDoneToday,
      [elementId]: isHabitDayComplete(total, config),
    },
  });
}

export const useEventStore = create<EventState>((set, get) => ({
  dailyTotals: {},
  yesterdayTotals: {},
  habitDoneToday: {},
  habitStreaks: {},
  activeTimerSessions: {},

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

  loadCounterTotals: async (elementIds) => {
    if (elementIds.length === 0) return;

    const db = await getDatabase();
    const today = todayDate();
    const yesterday = dateDaysAgo(1);
    const todayTotals: Record<string, number> = {};
    const yesterdayTotals: Record<string, number> = {};

    await Promise.all(
      elementIds.flatMap((id) => [
        eventRepo.getDailyTotal(db, id, today).then((total) => {
          todayTotals[id] = total;
        }),
        eventRepo.getDailyTotal(db, id, yesterday).then((total) => {
          yesterdayTotals[id] = total;
        }),
      ]),
    );

    set({
      dailyTotals: { ...get().dailyTotals, ...todayTotals },
      yesterdayTotals: { ...get().yesterdayTotals, ...yesterdayTotals },
    });
  },

  loadHabitDayState: async (habits, date = todayDate()) => {
    if (habits.length === 0) return;

    const db = await getDatabase();
    const totals: Record<string, number> = {};
    const status: Record<string, boolean> = {};

    await Promise.all(
      habits.map(async ({ id, config }) => {
        const total = await eventRepo.getDailyTotal(db, id, date);
        totals[id] = total;
        status[id] = isHabitDayComplete(total, config);
      }),
    );

    set({
      dailyTotals: { ...get().dailyTotals, ...totals },
      habitDoneToday: { ...get().habitDoneToday, ...status },
    });
  },

  loadHabitStreaks: async (habits) => {
    if (habits.length === 0) return;

    const streaks: Record<string, number> = {};
    await Promise.all(
      habits.map(async ({ id, config }) => {
        streaks[id] = await computeHabitStreak(id, config);
      }),
    );

    set({ habitStreaks: { ...get().habitStreaks, ...streaks } });
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
        meta: { source: 'manual' },
        protocolVersion: PROTOCOL_VERSION,
      });
    }

    await refreshTotal(elementId, date, set, get);
  },

  toggleHabit: async (elementId, config, date = todayDate()) => {
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

    const streak = await computeHabitStreak(elementId, config);

    set({
      habitDoneToday: { ...get().habitDoneToday, [elementId]: !done },
      habitStreaks: { ...get().habitStreaks, [elementId]: streak },
      dailyTotals: {
        ...get().dailyTotals,
        [elementId]: done ? 0 : 1,
      },
    });
  },

  startHabitTimer: (elementId) => {
    set({
      activeTimerSessions: {
        ...get().activeTimerSessions,
        [elementId]: { startedAt: new Date().toISOString() },
      },
    });
  },

  stopHabitTimer: async (elementId, config, date = todayDate()) => {
    const session = get().activeTimerSessions[elementId];
    if (!session) return;

    const startedAt = new Date(session.startedAt);
    const endedAt = new Date();
    const { value, meta } = buildTimerSessionPayload(startedAt, endedAt);

    const db = await getDatabase();
    await eventRepo.insertEvent(db, {
      id: newId(),
      elementId,
      timestamp: endedAt.toISOString(),
      date,
      value,
      meta,
      protocolVersion: PROTOCOL_VERSION,
    });

    const streak = await computeHabitStreak(elementId, config);
    const nextSessions = { ...get().activeTimerSessions };
    delete nextSessions[elementId];

    await refreshHabitStatus(elementId, config, date, set, get);

    set({
      activeTimerSessions: nextSessions,
      habitStreaks: { ...get().habitStreaks, [elementId]: streak },
    });
  },
}));

export function habitStreakInputsFromElements(
  elements: { id: string; kind: string; config: unknown }[],
): HabitStreakInput[] {
  return elements
    .filter((e) => e.kind === 'habit')
    .map((e) => ({
      id: e.id,
      config: HabitConfigSchema.parse(e.config),
    }));
}
