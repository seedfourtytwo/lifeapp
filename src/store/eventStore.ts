import { create } from 'zustand';
import { newId } from '../utils/id';
import {
  buildTimerSessionPayloadFromSession,
  createActiveTimerSession,
  habitNeedsEventMetaForCompletion,
  isHabitDayComplete,
  parseHabitConfig,
  PROTOCOL_VERSION,
  toDateString,
  type ActiveTimerSession,
  type HabitConfig,
} from '../protocol';
import { playHabitCompleteChime } from '../audio/habitCompleteSound';
import { sumEventValues } from '../utils/events';
import { playHabitCompleteHaptic } from '../utils/habitHaptics';
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
  /** Drop an in-progress timer without writing an event (archive/delete). */
  discardHabitTimer: (elementId: string) => void;
  resetHabitToday: (elementId: string, config: HabitConfig, date?: string) => Promise<void>;
}

function todayDate(): string {
  return toDateString(new Date());
}

/** Ignore stale load results if a newer load started. */
let habitDayLoadGeneration = 0;
let habitStreakLoadGeneration = 0;
let counterTotalLoadGeneration = 0;
const habitToggleInFlight = new Set<string>();

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

    const generation = ++counterTotalLoadGeneration;
    const db = await getDatabase();
    const today = todayDate();
    const totals = await eventRepo.getDailyTotalsForElementsOnDate(db, elementIds, today);
    if (generation !== counterTotalLoadGeneration) return;

    const todayTotals: Record<string, number> = {};
    for (const [id, total] of totals) {
      todayTotals[id] = total;
    }

    set({
      dailyTotals: { ...get().dailyTotals, ...todayTotals },
    });
  },

  loadHabitDayState: async (habits, date = todayDate()) => {
    if (habits.length === 0) return;

    const generation = ++habitDayLoadGeneration;
    const db = await getDatabase();
    const metaHabits = habits.filter((h) => habitNeedsEventMetaForCompletion(h.config));
    const totalHabits = habits.filter((h) => !habitNeedsEventMetaForCompletion(h.config));

    const totals: Record<string, number> = {};
    const status: Record<string, boolean> = {};

    if (totalHabits.length > 0) {
      const dayTotals = await eventRepo.getDailyTotalsForElementsOnDate(
        db,
        totalHabits.map((h) => h.id),
        date,
      );
      for (const { id, config } of totalHabits) {
        const total = dayTotals.get(id) ?? 0;
        totals[id] = total;
        status[id] = isHabitDayComplete(total, config);
      }
    }

    if (metaHabits.length > 0) {
      const eventsByElement = await eventRepo.getEventsForElementsOnDate(
        db,
        metaHabits.map((h) => h.id),
        date,
      );
      for (const { id, config } of metaHabits) {
        const events = eventsByElement.get(id) ?? [];
        const total = sumEventValues(events);
        totals[id] = total;
        status[id] = isHabitDayComplete(total, config, events);
      }
    }

    if (generation !== habitDayLoadGeneration) return;

    set({
      dailyTotals: { ...get().dailyTotals, ...totals },
      habitDoneToday: { ...get().habitDoneToday, ...status },
    });
  },

  loadHabitStreaks: async (habits) => {
    if (habits.length === 0) return;

    const generation = ++habitStreakLoadGeneration;
    const { streaks, failureStreaks } = await loadHabitStreakMaps(habits);
    if (generation !== habitStreakLoadGeneration) return;

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
    await db.withTransactionAsync(async () => {
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
    });

    await refreshTotal(elementId, date, set, get);
  },

  toggleHabit: async (elementId, config, date = todayDate()) => {
    if (habitToggleInFlight.has(elementId)) return;
    habitToggleInFlight.add(elementId);

    const done = get().habitDoneToday[elementId] ?? false;
    set({
      habitDoneToday: { ...get().habitDoneToday, [elementId]: !done },
      dailyTotals: {
        ...get().dailyTotals,
        [elementId]: done ? 0 : 1,
      },
    });

    try {
      const db = await getDatabase();
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
        void playHabitCompleteHaptic();
      }

      const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
      set({
        habitStreaks: { ...get().habitStreaks, [elementId]: streak },
        habitFailureStreaks: { ...get().habitFailureStreaks, [elementId]: failureStreak },
      });
    } catch (error) {
      set({
        habitDoneToday: { ...get().habitDoneToday, [elementId]: done },
        dailyTotals: {
          ...get().dailyTotals,
          [elementId]: done ? 1 : 0,
        },
      });
      throw error;
    } finally {
      habitToggleInFlight.delete(elementId);
    }
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
    const previousTotal = get().dailyTotals[elementId] ?? 0;
    const nextTotal = previousTotal + value;

    const db = await getDatabase();
    const existingEvents = await eventRepo.getEventsForElementOnDate(db, elementId, date);
    const nextEvents = [...existingEvents, { value, meta }];
    const wasComplete = isHabitDayComplete(previousTotal, config, existingEvents);
    const isComplete = isHabitDayComplete(nextTotal, config, nextEvents);

    await eventRepo.insertEvent(db, {
      id: newId(),
      elementId,
      timestamp: endedAt.toISOString(),
      date,
      value,
      meta,
      protocolVersion: PROTOCOL_VERSION,
    });

    const nextSessions = { ...get().activeTimerSessions };
    delete nextSessions[elementId];

    // Target-crossing chime plays live in HabitTimerWidget; only chime here for play-once end.
    if (options?.trackCompleted) {
      void playHabitCompleteChime();
    }
    if (!wasComplete && isComplete) {
      void playHabitCompleteHaptic();
    }

    const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);

    set({
      activeTimerSessions: nextSessions,
      dailyTotals: {
        ...get().dailyTotals,
        [elementId]: nextTotal,
      },
      habitDoneToday: {
        ...get().habitDoneToday,
        [elementId]: isComplete,
      },
      habitStreaks: { ...get().habitStreaks, [elementId]: streak },
      habitFailureStreaks: { ...get().habitFailureStreaks, [elementId]: failureStreak },
    });
  },

  discardHabitTimer: (elementId) => {
    const session = get().activeTimerSessions[elementId];
    if (!session) return;
    const nextSessions = { ...get().activeTimerSessions };
    delete nextSessions[elementId];
    set({ activeTimerSessions: nextSessions });
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
