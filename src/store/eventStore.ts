import { create } from 'zustand';
import { newId } from '../utils/id';
import {
  buildTimerSessionPayloadFromSession,
  createActiveTimerSession,
  CounterConfigSchema,
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
  loadPersistedActiveTimerSessions,
  persistActiveTimerSessions,
} from '../db/repositories/activeTimerRepository';
import {
  loadHabitStreakForElement,
  loadHabitStreakMaps,
  type HabitStreakInput,
} from './habitStreakFetch';
import {
  loadCounterStreakForElement,
  loadCounterStreakMaps,
  type CounterStreakInput,
} from './counterStreakFetch';
import {
  bumpWriteEpoch,
  captureWriteEpochs,
  getWriteEpoch,
  mergeUnchangedEntries,
} from './writeEpoch';
import { withDbWriteLock } from '../db/writeLock';
import type { ResettableMirror } from './mirrorReset';
import { getDataGeneration } from '../db/dataGeneration';

export type { HabitStreakInput, CounterStreakInput };

let persistTimersChain: Promise<void> = Promise.resolve();

/** Production waits for bootstrap hydrate; tests start ready so unit tests don't hang. */
let activeTimersReady = process.env.NODE_ENV === 'test';
let activeTimersReadyWaiters: (() => void)[] = [];

function markActiveTimersReady(): void {
  activeTimersReady = true;
  const waiters = activeTimersReadyWaiters;
  activeTimersReadyWaiters = [];
  for (const wake of waiters) wake();
}

/** Resolves after bootstrap finishes timer hydrate + day-state (or immediately in tests). */
export function whenActiveTimersReady(): Promise<void> {
  if (activeTimersReady) return Promise.resolve();
  return new Promise((resolve) => {
    activeTimersReadyWaiters.push(resolve);
  });
}

/** Called from bootstrap after hydrate/day-state, or on element-load failure. */
export function releaseActiveTimersReady(): void {
  markActiveTimersReady();
}

function schedulePersistActiveTimers(
  sessions: Record<string, ActiveTimerSession>,
): void {
  persistTimersChain = persistTimersChain
    .catch(() => undefined)
    .then(async () => persistActiveTimerSessions(await getDatabase(), sessions))
    .catch((error) => {
      console.warn('Failed to persist active timer sessions', error);
    });
}

interface EventState extends ResettableMirror {
  dailyTotals: Record<string, number>;
  habitDoneToday: Record<string, boolean>;
  habitStreaks: Record<string, number>;
  habitFailureStreaks: Record<string, number>;
  counterStreaks: Record<string, number>;
  activeTimerSessions: Record<string, ActiveTimerSession>;
  /** True after at least one successful habit day-state load this process. */
  dayStateReady: boolean;
  /** True after at least one successful counter totals load this process. */
  counterTotalsReady: boolean;
  /** Restore in-progress timers after process death (call once at bootstrap). */
  hydrateActiveTimerSessions: () => Promise<void>;
  loadCounterTotals: (elementIds: string[]) => Promise<void>;
  loadCounterStreaks: (counters: CounterStreakInput[]) => Promise<void>;
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
    options?: { trackCompleted?: boolean; playChime?: boolean },
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
let counterStreakLoadGeneration = 0;
const habitToggleInFlight = new Set<string>();
/** Serialize counter log/set-total so edit + quick-add can't interleave. */
const counterWriteChains = new Map<string, Promise<void>>();
/** Joinable stop promises — rollover/Done await the same in-flight stop. */
const habitTimerStopPromises = new Map<string, Promise<void>>();
/** Merged options for joiners (e.g. trackCompleted from natural end after Done started). */
const habitTimerStopOptions = new Map<
  string,
  { trackCompleted?: boolean; playChime?: boolean }
>;
/** Stops that must not restore the session on failure (archive/delete in flight). */
const habitTimerStopAbortRestore = new Set<string>();

export async function awaitHabitTimerStops(): Promise<void> {
  const pending = [...habitTimerStopPromises.values()];
  if (pending.length === 0) return;
  await Promise.allSettled(pending);
}

/** Drain in-flight counter writes and habit toggles before a destructive wipe. */
export async function awaitPendingEventWrites(): Promise<void> {
  await awaitHabitTimerStops();
  const counterPending = [...counterWriteChains.values()];
  if (counterPending.length > 0) {
    await Promise.allSettled(counterPending);
  }
  // Toggles are short; wait a tick for in-flight Set members by polling briefly.
  const deadline = Date.now() + 2_000;
  while (habitToggleInFlight.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Drain pending event writes for one element (archive/delete). */
export async function awaitElementEventWrites(elementId: string): Promise<void> {
  await awaitHabitTimerStop(elementId);
  const counterPending = counterWriteChains.get(elementId);
  if (counterPending) await Promise.allSettled([counterPending]);
  const deadline = Date.now() + 2_000;
  while (habitToggleInFlight.has(elementId) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export async function awaitHabitTimerStop(elementId: string): Promise<void> {
  const pending = habitTimerStopPromises.get(elementId);
  if (pending) await pending;
}

/** Prevent an in-flight stop from rehydrating a session after archive/delete. */
export function abortHabitTimerRestore(elementId: string): void {
  habitTimerStopAbortRestore.add(elementId);
}

function enqueueCounterWrite(
  elementId: string,
  work: (dataEpochAtStart: number, writeEpochAtStart: number) => Promise<void>,
): Promise<void> {
  const previous = counterWriteChains.get(elementId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const dataEpochAtStart = getDataGeneration('protocol');
    const writeEpochAtStart = getWriteEpoch(elementId);
    await work(dataEpochAtStart, writeEpochAtStart);
  });
  counterWriteChains.set(
    elementId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

/**
 * True once this write has been overtaken — either the whole dataset was
 * replaced (import / clear bumps the `protocol` data generation) or a newer
 * write for the same element landed while we were awaiting SQLite.
 *
 * Every await inside a write must re-check this before touching the DB or the
 * store, so it is one predicate rather than a condition copied per call site.
 */
function eventWriteSuperseded(
  dataEpochAtStart: number,
  elementId: string,
  writeEpochAtStart: number,
): boolean {
  return (
    dataEpochAtStart !== getDataGeneration('protocol') ||
    getWriteEpoch(elementId) !== writeEpochAtStart
  );
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

/** After a counter write, refresh target-hit streak when the element has a daily target. */
async function refreshCounterStreakAfterWrite(
  elementId: string,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): Promise<void> {
  const writeEpochAtStart = getWriteEpoch(elementId);
  try {
    const { useElementStore } = await import('./elementStore');
    const element = useElementStore.getState().elements.find((el) => el.id === elementId);
    if (!element || element.kind !== 'counter') return;
    const parsed = CounterConfigSchema.safeParse(element.config);
    if (!parsed.success || !parsed.data.dailyTarget) return;
    const streak = await loadCounterStreakForElement(
      elementId,
      parsed.data,
      element.createdAt,
    );
    // A newer + / set-total may have finished while we were querying history.
    if (getWriteEpoch(elementId) !== writeEpochAtStart) return;
    set({
      counterStreaks: { ...get().counterStreaks, [elementId]: streak },
    });
  } catch {
    // Non-fatal — focus refresh will catch up.
  }
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
  counterStreaks: {},
  activeTimerSessions: {},
  dayStateReady: false,
  counterTotalsReady: false,

  reset: async () => {
    // The *Ready flags go back to false with the maps: the loaders that set
    // them true are what refills these, and until they run nothing here is
    // known — a screen must wait rather than read an empty map as "zero today".
    set({
      dailyTotals: {},
      habitDoneToday: {},
      habitStreaks: {},
      habitFailureStreaks: {},
      counterStreaks: {},
      activeTimerSessions: {},
      dayStateReady: false,
      counterTotalsReady: false,
    });
  },

  hydrateActiveTimerSessions: async () => {
    const sessions = await loadPersistedActiveTimerSessions(await getDatabase());
    if (Object.keys(sessions).length === 0) return;
    // Do not clobber a timer started before hydration finished.
    if (Object.keys(get().activeTimerSessions).length > 0) return;

    const { useElementStore } = await import('./elementStore');
    const elements = useElementStore.getState().elements;
    const habitsById = new Map(
      elements.filter((el) => el.kind === 'habit').map((el) => [el.id, el]),
    );
    const today = todayDate();
    const kept: Record<string, ActiveTimerSession> = {};

    for (const [id, session] of Object.entries(sessions)) {
      const element = habitsById.get(id);
      if (!element) {
        // Habit gone — drop orphaned persistence without inventing an event.
        console.warn('Dropping persisted timer for missing habit', id);
        continue;
      }

      if (session.calendarDate !== today) {
        // Cold start after midnight — finalize onto the day the timer belonged to.
        set({
          activeTimerSessions: {
            ...get().activeTimerSessions,
            [id]: session,
          },
        });
        try {
          await get().stopHabitTimer(id, parseHabitConfig(element.config));
        } catch (error) {
          console.warn('Failed to finalize stale timer on hydrate', error);
          get().discardHabitTimer(id);
        }
        continue;
      }

      kept[id] = session;
    }

    // Keep at most one session (matches runtime single-timer rule).
    // Finalize extras so their elapsed time is logged instead of dropped.
    const keptIds = Object.keys(kept);
    for (const id of keptIds.slice(1)) {
      const element = habitsById.get(id);
      if (!element) continue;
      set({
        activeTimerSessions: {
          ...get().activeTimerSessions,
          [id]: kept[id],
        },
      });
      try {
        await get().stopHabitTimer(id, parseHabitConfig(element.config));
      } catch (error) {
        console.warn('Failed to finalize extra timer on hydrate', error);
        get().discardHabitTimer(id);
      }
      delete kept[id];
    }

    const firstId = Object.keys(kept)[0];
    // User may have started a timer while we finalized persisted rows — never clobber.
    if (Object.keys(get().activeTimerSessions).length > 0) {
      schedulePersistActiveTimers(get().activeTimerSessions);
      return;
    }
    const activeTimerSessions = firstId ? { [firstId]: kept[firstId] } : {};
    set({ activeTimerSessions });
    schedulePersistActiveTimers(activeTimerSessions);
  },

  loadCounterTotals: async (elementIds) => {
    if (elementIds.length === 0) {
      set({ counterTotalsReady: true });
      return;
    }

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
      counterTotalsReady: true,
    });
  },

  loadCounterStreaks: async (counters) => {
    if (counters.length === 0) return;
    const generation = ++counterStreakLoadGeneration;
    const epochs = captureWriteEpochs(counters.map((c) => c.id));
    const streaks = await loadCounterStreakMaps(counters);
    if (generation !== counterStreakLoadGeneration) return;
    set({
      counterStreaks: {
        ...get().counterStreaks,
        ...mergeUnchangedEntries(streaks, epochs),
      },
    });
  },

  loadHabitDayState: async (habits, date = todayDate()) => {
    if (habits.length === 0) {
      set({ dayStateReady: true });
      return;
    }

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
    enqueueCounterWrite(elementId, async (dataEpochAtStart, writeEpochAtStart) => {
      if (eventWriteSuperseded(dataEpochAtStart, elementId, writeEpochAtStart)) return;
      const ourWriteEpoch = bumpWriteEpoch(elementId);
      let wrote = false;
      await withDbWriteLock(async () => {
        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        const now = new Date();
        const date = toDateString(now);
        await eventRepo.insertEvent(await getDatabase(), {
          id: newId(),
          elementId,
          timestamp: now.toISOString(),
          date,
          value,
          meta,
          protocolVersion: PROTOCOL_VERSION,
        });

        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        await refreshTotal(elementId, date, set, get);
        wrote = true;
      });
      if (wrote) await refreshCounterStreakAfterWrite(elementId, set, get);
    }),

  setDailyTotal: (elementId, total, date = todayDate()) =>
    enqueueCounterWrite(elementId, async (dataEpochAtStart, writeEpochAtStart) => {
      if (total < 0 || !Number.isFinite(total)) {
        throw new Error('Total must be a non-negative number');
      }
      if (eventWriteSuperseded(dataEpochAtStart, elementId, writeEpochAtStart)) return;

      const ourWriteEpoch = bumpWriteEpoch(elementId);
      let wrote = false;
      await withDbWriteLock(async () => {
        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        const db = await getDatabase();
        await eventRepo.setDailyTotalForElement(db, elementId, date, total, {
          id: newId(),
          timestamp: new Date().toISOString(),
          meta: { source: 'manual' },
        });

        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        await refreshTotal(elementId, date, set, get);
        wrote = true;
      });
      if (wrote) await refreshCounterStreakAfterWrite(elementId, set, get);
    }),

  toggleHabit: async (elementId, config, date = todayDate()) => {
    if (habitToggleInFlight.has(elementId)) return;
    habitToggleInFlight.add(elementId);
    const dataEpochAtStart = getDataGeneration('protocol');
    const writeEpochAtStart = getWriteEpoch(elementId);
    if (eventWriteSuperseded(dataEpochAtStart, elementId, writeEpochAtStart)) {
      habitToggleInFlight.delete(elementId);
      return;
    }
    const ourWriteEpoch = bumpWriteEpoch(elementId);

    const done = get().habitDoneToday[elementId] ?? false;
    applyTodayMaps(
      elementId,
      date,
      { habitDone: !done, dailyTotal: done ? 0 : 1 },
      set,
      get,
    );

    try {
      await withDbWriteLock(async () => {
        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
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

        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
        applyTodayMaps(elementId, date, { streak, failureStreak }, set, get);
      });
    } catch (error) {
      if (!eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
        applyTodayMaps(
          elementId,
          date,
          { habitDone: done, dailyTotal: done ? 1 : 0 },
          set,
          get,
        );
      }
      throw error;
    } finally {
      habitToggleInFlight.delete(elementId);
    }
  },

  startHabitTimer: (elementId) => {
    if (get().activeTimerSessions[elementId]) return;
    const activeTimerSessions = {
      ...get().activeTimerSessions,
      [elementId]: createActiveTimerSession(),
    };
    set({ activeTimerSessions });
    schedulePersistActiveTimers(activeTimerSessions);
  },

  pauseHabitTimer: (elementId) => {
    const session = get().activeTimerSessions[elementId];
    if (!session || session.pausedAt) return;

    const activeTimerSessions = {
      ...get().activeTimerSessions,
      [elementId]: {
        ...session,
        pausedAt: new Date().toISOString(),
      },
    };
    set({ activeTimerSessions });
    schedulePersistActiveTimers(activeTimerSessions);
  },

  resumeHabitTimer: (elementId) => {
    const session = get().activeTimerSessions[elementId];
    if (!session?.pausedAt) return;

    const pausedMs = Date.now() - new Date(session.pausedAt).getTime();
    const activeTimerSessions = {
      ...get().activeTimerSessions,
      [elementId]: {
        ...session,
        pausedAt: null,
        pauseOffsetMs: session.pauseOffsetMs + pausedMs,
      },
    };
    set({ activeTimerSessions });
    schedulePersistActiveTimers(activeTimerSessions);
  },

  stopHabitTimer: (elementId, config, _date, options) => {
    const existing = habitTimerStopPromises.get(elementId);
    if (options?.trackCompleted || options?.playChime) {
      const merged = habitTimerStopOptions.get(elementId) ?? {};
      habitTimerStopOptions.set(elementId, {
        ...merged,
        ...(options.trackCompleted ? { trackCompleted: true } : {}),
        ...(options.playChime ? { playChime: true } : {}),
      });
    }
    if (existing) return existing;

    habitTimerStopOptions.set(elementId, {
      trackCompleted: options?.trackCompleted,
      playChime: options?.playChime,
    });

    const promise = (async () => {
      const session = get().activeTimerSessions[elementId];
      if (!session) return;

      const dataEpochAtStart = getDataGeneration('protocol');
      // Persist onto the day the timer started — not the day Done/rollover ran.
      const persistDate = session.calendarDate;
      const ourWriteEpoch = bumpWriteEpoch(elementId);

      const endedAt = new Date();
      const stopOpts = habitTimerStopOptions.get(elementId);
      const { value, meta } = buildTimerSessionPayloadFromSession(session, endedAt, stopOpts);
      const previousTotal = get().dailyTotals[elementId] ?? 0;
      const nextTotal = previousTotal + value;

      // Clear session immediately so double-taps can't double-insert.
      const nextSessions = { ...get().activeTimerSessions };
      delete nextSessions[elementId];
      set({ activeTimerSessions: nextSessions });
      schedulePersistActiveTimers(nextSessions);
      applyTodayMaps(elementId, persistDate, { dailyTotal: nextTotal }, set, get);

      try {
        await withDbWriteLock(async () => {
          if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
            return;
          }

          const db = await getDatabase();
          const existingEvents = await eventRepo.getEventsForElementOnDate(
            db,
            elementId,
            persistDate,
          );
          const nextEvents = [...existingEvents, { value, meta }];
          const wasComplete = isHabitDayComplete(previousTotal, config, existingEvents);
          const isComplete = isHabitDayComplete(nextTotal, config, nextEvents);

          if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
            return;
          }

          await eventRepo.insertEvent(db, {
            id: newId(),
            elementId,
            timestamp: endedAt.toISOString(),
            date: persistDate,
            value,
            meta,
            protocolVersion: PROTOCOL_VERSION,
          });

          if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
            return;
          }

          // Target-crossing chime plays live in HabitTimerWidget.
          // Natural play-once end sets playChime; manual Done must not chime.
          if (stopOpts?.playChime) {
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
        });
      } catch (error) {
        if (
          eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch) ||
          habitTimerStopAbortRestore.has(elementId)
        ) {
          throw error;
        }
        const restored = {
          ...get().activeTimerSessions,
          [elementId]: session,
        };
        set({ activeTimerSessions: restored });
        schedulePersistActiveTimers(restored);
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
    schedulePersistActiveTimers(nextSessions);
  },

  resetHabitToday: async (elementId, config, date = todayDate()) => {
    const pendingStop = habitTimerStopPromises.get(elementId);
    if (pendingStop) await pendingStop;

    // Persist any leftover session (including yesterday's) before wiping today.
    const session = get().activeTimerSessions[elementId];
    if (session) {
      try {
        await get().stopHabitTimer(elementId, config);
      } catch (error) {
        console.warn('Failed to finalize timer before reset', error);
        get().discardHabitTimer(elementId);
      }
    }

    const dataEpochAtStart = getDataGeneration('protocol');
    const ourWriteEpoch = bumpWriteEpoch(elementId);
    await withDbWriteLock(async () => {
      if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
        return;
      }
      const db = await getDatabase();
      await eventRepo.deleteEventsForElementOnDate(db, elementId, date);

      if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
        return;
      }

      const nextSessions = { ...get().activeTimerSessions };
      delete nextSessions[elementId];
      set({ activeTimerSessions: nextSessions });
      schedulePersistActiveTimers(nextSessions);
      applyTodayMaps(elementId, date, { dailyTotal: 0, habitDone: false }, set, get);

      try {
        const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
        applyTodayMaps(elementId, date, { streak, failureStreak }, set, get);
      } catch {
        // Day wipe already applied; streaks can refresh on next focus.
      }
    });
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

/** Counters with a daily target — inputs for target-hit streak loads. */
export function counterStreakInputsFromElements(
  elements: { id: string; kind: string; config: unknown; createdAt?: string | null }[],
): CounterStreakInput[] {
  const inputs: CounterStreakInput[] = [];
  for (const e of elements) {
    if (e.kind !== 'counter') continue;
    const parsed = CounterConfigSchema.safeParse(e.config);
    if (!parsed.success || !parsed.data.dailyTarget) continue;
    inputs.push({
      id: e.id,
      config: parsed.data,
      createdAt: e.createdAt ?? null,
    });
  }
  return inputs;
}
