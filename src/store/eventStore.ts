import { create } from 'zustand';
import { newId } from '../utils/id';
import {
  buildTimerSessionPayloadFromSession,
  createActiveTimerSession,
  isHabitDayComplete,
  parseHabitConfig,
  PROTOCOL_VERSION,
  toDateString,
  type ActiveTimerSession,
  type HabitConfig,
} from '../protocol';
import { playHabitCompleteChime } from '../audio/habitCompleteSound';
import { sumEventValues } from '../utils/events';
import { shouldPlayHabitCompletionChime } from '../utils/habitCompletionChime';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';
import {
  loadHabitStreakForElement,
  loadHabitStreakMaps,
  type HabitStreakInput,
} from './habitStreakFetch';

export type { HabitStreakInput };

interface EventState {
  dailyTotals: Record<string, number>;
  habitDoneToday: Record<string, boolean>;
  habitStreaks: Record<string, number>;
  habitFailureStreaks: Record<string, number>;
  activeTimerSessions: Record<string, ActiveTimerSession>;
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
  pauseHabitTimer: (elementId: string) => void;
  resumeHabitTimer: (elementId: string) => void;
  stopHabitTimer: (
    elementId: string,
    config: HabitConfig,
    date?: string,
    options?: { trackCompleted?: boolean },
  ) => Promise<void>;
  resetHabitToday: (elementId: string, config: HabitConfig, date?: string) => Promise<void>;
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
  habitStreaks: {},
  habitFailureStreaks: {},
  activeTimerSessions: {},

  loadCounterTotals: async (elementIds) => {
    if (elementIds.length === 0) return;

    const db = await getDatabase();
    const today = todayDate();
    const todayTotals: Record<string, number> = {};

    await Promise.all(
      elementIds.map(async (id) => {
        todayTotals[id] = await eventRepo.getDailyTotal(db, id, today);
      }),
    );

    set({
      dailyTotals: { ...get().dailyTotals, ...todayTotals },
    });
  },

  loadHabitDayState: async (habits, date = todayDate()) => {
    if (habits.length === 0) return;

    const db = await getDatabase();
    const ids = habits.map((habit) => habit.id);
    const eventsByElement = await eventRepo.getEventsForElementsOnDate(db, ids, date);
    const totals: Record<string, number> = {};
    const status: Record<string, boolean> = {};

    for (const { id, config } of habits) {
      const events = eventsByElement.get(id) ?? [];
      const total = sumEventValues(events);
      totals[id] = total;
      status[id] = isHabitDayComplete(total, config, events);
    }

    set({
      dailyTotals: { ...get().dailyTotals, ...totals },
      habitDoneToday: { ...get().habitDoneToday, ...status },
    });
  },

  loadHabitStreaks: async (habits) => {
    if (habits.length === 0) return;

    const { streaks, failureStreaks } = await loadHabitStreakMaps(habits);
    set({
      habitStreaks: { ...get().habitStreaks, ...streaks },
      habitFailureStreaks: { ...get().habitFailureStreaks, ...failureStreaks },
    });
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

    const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);

    set({
      habitDoneToday: { ...get().habitDoneToday, [elementId]: !done },
      habitStreaks: { ...get().habitStreaks, [elementId]: streak },
      habitFailureStreaks: { ...get().habitFailureStreaks, [elementId]: failureStreak },
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
        [elementId]: createActiveTimerSession(),
      },
    });
  },

  pauseHabitTimer: (elementId) => {
    const session = get().activeTimerSessions[elementId];
    if (!session || session.pausedAt) return;

    set({
      activeTimerSessions: {
        ...get().activeTimerSessions,
        [elementId]: {
          ...session,
          pausedAt: new Date().toISOString(),
        },
      },
    });
  },

  resumeHabitTimer: (elementId) => {
    const session = get().activeTimerSessions[elementId];
    if (!session?.pausedAt) return;

    const pausedMs = Date.now() - new Date(session.pausedAt).getTime();
    set({
      activeTimerSessions: {
        ...get().activeTimerSessions,
        [elementId]: {
          ...session,
          pausedAt: null,
          pauseOffsetMs: session.pauseOffsetMs + pausedMs,
        },
      },
    });
  },

  stopHabitTimer: async (elementId, config, date = todayDate(), options) => {
    const session = get().activeTimerSessions[elementId];
    if (!session) return;

    const endedAt = new Date();
    const { value, meta } = buildTimerSessionPayloadFromSession(session, endedAt, options);

    const nextSessions = { ...get().activeTimerSessions };
    delete nextSessions[elementId];

    const previousTotal = get().dailyTotals[elementId] ?? 0;
    const optimisticTotal = previousTotal + value;

    const db = await getDatabase();
    const existingEvents = await eventRepo.getEventsForElementOnDate(db, elementId, date);
    const optimisticEvents = [...existingEvents, { value, meta }];

    if (
      shouldPlayHabitCompletionChime(
        config,
        previousTotal,
        optimisticTotal,
        existingEvents,
        optimisticEvents,
        options,
      )
    ) {
      void playHabitCompleteChime();
    }

    set({
      activeTimerSessions: nextSessions,
      dailyTotals: {
        ...get().dailyTotals,
        [elementId]: optimisticTotal,
      },
      habitDoneToday: {
        ...get().habitDoneToday,
        [elementId]: isHabitDayComplete(optimisticTotal, config, optimisticEvents),
      },
    });

    await eventRepo.insertEvent(db, {
      id: newId(),
      elementId,
      timestamp: endedAt.toISOString(),
      date,
      value,
      meta,
      protocolVersion: PROTOCOL_VERSION,
    });

    const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);

    set({
      habitStreaks: { ...get().habitStreaks, [elementId]: streak },
      habitFailureStreaks: { ...get().habitFailureStreaks, [elementId]: failureStreak },
    });
  },

  resetHabitToday: async (elementId, config, date = todayDate()) => {
    const db = await getDatabase();
    await eventRepo.deleteEventsForElementOnDate(db, elementId, date);

    const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
    const nextSessions = { ...get().activeTimerSessions };
    delete nextSessions[elementId];

    set({
      activeTimerSessions: nextSessions,
      dailyTotals: { ...get().dailyTotals, [elementId]: 0 },
      habitDoneToday: { ...get().habitDoneToday, [elementId]: false },
      habitStreaks: { ...get().habitStreaks, [elementId]: streak },
      habitFailureStreaks: { ...get().habitFailureStreaks, [elementId]: failureStreak },
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
      config: parseHabitConfig(e.config),
    }));
}
