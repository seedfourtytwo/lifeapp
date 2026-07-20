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
import { currentAppCalendarDate } from '../utils/dayRollover';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';
import {
  loadHabitStreakForElement,
  loadHabitStreakMaps,
  type HabitStreakInput,
} from './habitStreakFetch';
import {
  bumpWriteEpoch,
  captureWriteEpochs,
  mergeUnchangedEntries,
} from './writeEpoch';

export type { HabitStreakInput };

interface EventState {
  dailyTotals: Record<string, number>;
  habitDoneToday: Record<string, boolean>;
  habitStreaks: Record<string, number>;
  habitFailureStreaks: Record<string, number>;
  activeTimerSessions: Record<string, ActiveTimerSession>;
  /** True after at least one successful habit day-state load this process. */
  dayStateReady: boolean;
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
  return currentAppCalendarDate();
}

/** Ignore stale load results if a newer load started. */
let habitDayLoadGeneration = 0;
let habitStreakLoadGeneration = 0;
let counterTotalLoadGeneration = 0;
/** Bumped on import/clear so in-flight stops don't write into a replaced DB. */
let dataEpoch = 0;
const habitToggleInFlight = new Set<string>();
/** Serialize counter log/set-total so edit + quick-add can't interleave. */
const counterWriteChains = new Map<string, Promise<void>>();
/** Joinable stop promises — rollover/Done await the same in-flight stop. */
const habitTimerStopPromises = new Map<string, Promise<void>>();
/** Merged options for joiners (e.g. trackCompleted from natural end after Done started). */
const habitTimerStopOptions = new Map<string, { trackCompleted?: boolean }>();
/** Stops that must not restore the session on failure (archive/delete in flight). */
const habitTimerStopAbortRestore = new Set<string>();

export function bumpEventDataEpoch(): void {
  dataEpoch += 1;
}

export async function awaitHabitTimerStops(): Promise<void> {
  const pending = [...habitTimerStopPromises.values()];
  if (pending.length === 0) return;
  await Promise.allSettled(pending);
}

export async function awaitHabitTimerStop(elementId: string): Promise<void> {
  const pending = habitTimerStopPromises.get(elementId);
  if (pending) await pending;
}

/** Prevent an in-flight stop from rehydrating a session after archive/delete. */
export function abortHabitTimerRestore(elementId: string): void {
  habitTimerStopAbortRestore.add(elementId);
}

function enqueueCounterWrite(elementId: string, work: () => Promise<void>): Promise<void> {
  const previous = counterWriteChains.get(elementId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  counterWriteChains.set(
    elementId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

async function refreshTotal(
  elementId: string,
  date: string,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): Promise<void> {
  if (date !== todayDate()) return;
  const db = await getDatabase();
  const total = await eventRepo.getDailyTotal(db, elementId, date);
  set({ dailyTotals: { ...get().dailyTotals, [elementId]: total } });
}

function applyTodayMaps(
  elementId: string,
  date: string,
  patch: Partial<{
    dailyTotal: number;
    habitDone: boolean;
    streak: number;
    failureStreak: number;
  }>,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): void {
  if (date !== todayDate()) return;
  set({
    ...(patch.dailyTotal !== undefined
      ? { dailyTotals: { ...get().dailyTotals, [elementId]: patch.dailyTotal } }
      : {}),
    ...(patch.habitDone !== undefined
      ? { habitDoneToday: { ...get().habitDoneToday, [elementId]: patch.habitDone } }
      : {}),
    ...(patch.streak !== undefined
      ? { habitStreaks: { ...get().habitStreaks, [elementId]: patch.streak } }
      : {}),
    ...(patch.failureStreak !== undefined
      ? {
          habitFailureStreaks: {
            ...get().habitFailureStreaks,
            [elementId]: patch.failureStreak,
          },
        }
      : {}),
  });
}

export const useEventStore = create<EventState>((set, get) => ({
  dailyTotals: {},
  habitDoneToday: {},
  habitStreaks: {},
  habitFailureStreaks: {},
  activeTimerSessions: {},
  dayStateReady: false,

  loadCounterTotals: async (elementIds) => {
    if (elementIds.length === 0) return;

    const generation = ++counterTotalLoadGeneration;
    const epochs = captureWriteEpochs(elementIds);
    const db = await getDatabase();
    const today = todayDate();
    const totals = await eventRepo.getDailyTotalsForElementsOnDate(db, elementIds, today);
    if (generation !== counterTotalLoadGeneration) return;

    const todayTotals: Record<string, number> = {};
    for (const [id, total] of totals) {
      todayTotals[id] = total;
    }

    set({
      dailyTotals: {
        ...get().dailyTotals,
        ...mergeUnchangedEntries(todayTotals, epochs),
      },
    });
  },

  loadHabitDayState: async (habits, date = todayDate()) => {
    if (habits.length === 0) return;

    const generation = ++habitDayLoadGeneration;
    const epochs = captureWriteEpochs(habits.map((h) => h.id));
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
      dailyTotals: {
        ...get().dailyTotals,
        ...mergeUnchangedEntries(totals, epochs),
      },
      habitDoneToday: {
        ...get().habitDoneToday,
        ...mergeUnchangedEntries(status, epochs),
      },
      dayStateReady: true,
    });
  },

  loadHabitStreaks: async (habits) => {
    if (habits.length === 0) return;

    const generation = ++habitStreakLoadGeneration;
    const epochs = captureWriteEpochs(habits.map((h) => h.id));
    const { streaks, failureStreaks } = await loadHabitStreakMaps(habits);
    if (generation !== habitStreakLoadGeneration) return;

    set({
      habitStreaks: {
        ...get().habitStreaks,
        ...mergeUnchangedEntries(streaks, epochs),
      },
      habitFailureStreaks: {
        ...get().habitFailureStreaks,
        ...mergeUnchangedEntries(failureStreaks, epochs),
      },
    });
  },

  logEvent: (elementId, value, meta) =>
    enqueueCounterWrite(elementId, async () => {
      bumpWriteEpoch(elementId);
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
    }),

  setDailyTotal: (elementId, total, date = todayDate()) =>
    enqueueCounterWrite(elementId, async () => {
      if (total < 0 || !Number.isFinite(total)) {
        throw new Error('Total must be a non-negative number');
      }

      bumpWriteEpoch(elementId);
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
    }),

  toggleHabit: async (elementId, config, date = todayDate()) => {
    if (habitToggleInFlight.has(elementId)) return;
    habitToggleInFlight.add(elementId);
    bumpWriteEpoch(elementId);

    const done = get().habitDoneToday[elementId] ?? false;
    applyTodayMaps(
      elementId,
      date,
      { habitDone: !done, dailyTotal: done ? 0 : 1 },
      set,
      get,
    );

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
      applyTodayMaps(elementId, date, { streak, failureStreak }, set, get);
    } catch (error) {
      applyTodayMaps(
        elementId,
        date,
        { habitDone: done, dailyTotal: done ? 1 : 0 },
        set,
        get,
      );
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

  stopHabitTimer: (elementId, config, _date, options) => {
    const existing = habitTimerStopPromises.get(elementId);
    if (options?.trackCompleted) {
      const merged = habitTimerStopOptions.get(elementId) ?? {};
      habitTimerStopOptions.set(elementId, { ...merged, trackCompleted: true });
    }
    if (existing) return existing;

    habitTimerStopOptions.set(elementId, { trackCompleted: options?.trackCompleted });

    const promise = (async () => {
      const session = get().activeTimerSessions[elementId];
      if (!session) return;

      const epochAtStart = dataEpoch;
      // Persist onto the day the timer started — not the day Done/rollover ran.
      const persistDate = session.calendarDate;
      bumpWriteEpoch(elementId);

      const endedAt = new Date();
      const stopOpts = habitTimerStopOptions.get(elementId);
      const { value, meta } = buildTimerSessionPayloadFromSession(session, endedAt, stopOpts);
      const previousTotal = get().dailyTotals[elementId] ?? 0;
      const nextTotal = previousTotal + value;

      // Clear session immediately so double-taps can't double-insert.
      const nextSessions = { ...get().activeTimerSessions };
      delete nextSessions[elementId];
      set({ activeTimerSessions: nextSessions });
      applyTodayMaps(elementId, persistDate, { dailyTotal: nextTotal }, set, get);

      try {
        if (epochAtStart !== dataEpoch) return;

        const db = await getDatabase();
        const existingEvents = await eventRepo.getEventsForElementOnDate(
          db,
          elementId,
          persistDate,
        );
        const nextEvents = [...existingEvents, { value, meta }];
        const wasComplete = isHabitDayComplete(previousTotal, config, existingEvents);
        const isComplete = isHabitDayComplete(nextTotal, config, nextEvents);

        if (epochAtStart !== dataEpoch) return;

        await eventRepo.insertEvent(db, {
          id: newId(),
          elementId,
          timestamp: endedAt.toISOString(),
          date: persistDate,
          value,
          meta,
          protocolVersion: PROTOCOL_VERSION,
        });

        if (epochAtStart !== dataEpoch) return;

        // Target-crossing chime plays live in HabitTimerWidget; only chime here for play-once end.
        if (stopOpts?.trackCompleted) {
          void playHabitCompleteChime();
        }
        if (!wasComplete && isComplete) {
          void playHabitCompleteHaptic();
        }

        const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
        applyTodayMaps(
          elementId,
          persistDate,
          { dailyTotal: nextTotal, habitDone: isComplete, streak, failureStreak },
          set,
          get,
        );
      } catch (error) {
        if (epochAtStart !== dataEpoch || habitTimerStopAbortRestore.has(elementId)) {
          throw error;
        }
        set({
          activeTimerSessions: {
            ...get().activeTimerSessions,
            [elementId]: session,
          },
        });
        applyTodayMaps(elementId, persistDate, { dailyTotal: previousTotal }, set, get);
        throw error;
      }
    })();

    habitTimerStopPromises.set(elementId, promise);
    return promise.finally(() => {
      if (habitTimerStopPromises.get(elementId) === promise) {
        habitTimerStopPromises.delete(elementId);
      }
      habitTimerStopOptions.delete(elementId);
      habitTimerStopAbortRestore.delete(elementId);
    });
  },

  discardHabitTimer: (elementId) => {
    const nextSessions = { ...get().activeTimerSessions };
    delete nextSessions[elementId];
    set({ activeTimerSessions: nextSessions });
  },

  resetHabitToday: async (elementId, config, date = todayDate()) => {
    const pendingStop = habitTimerStopPromises.get(elementId);
    if (pendingStop) await pendingStop;

    bumpWriteEpoch(elementId);
    const db = await getDatabase();
    await eventRepo.deleteEventsForElementOnDate(db, elementId, date);

    const nextSessions = { ...get().activeTimerSessions };
    delete nextSessions[elementId];
    set({ activeTimerSessions: nextSessions });
    applyTodayMaps(elementId, date, { dailyTotal: 0, habitDone: false }, set, get);

    try {
      const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
      applyTodayMaps(elementId, date, { streak, failureStreak }, set, get);
    } catch {
      // Day wipe already applied; streaks can refresh on next focus.
    }
  },
}));

export function habitStreakInputsFromElements(
  elements: { id: string; kind: string; config: unknown; createdAt?: string | null }[],
): HabitStreakInput[] {
  return elements
    .filter((e) => e.kind === 'habit')
    .map((e) => ({
      id: e.id,
      config: parseHabitConfig(e.config),
      createdAt: e.createdAt ?? null,
    }));
}
