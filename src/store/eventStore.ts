import { create } from 'zustand';
import { newId } from '../utils/id';
import {
  buildTimerSessionPayloadFromDuration,
  createActiveTimerSession,
  activeTimerElapsedMs,
  dayFactsFromEvents,
  dayOutcome,
  factsFromTotal,
  HabitEventMetaSchema,
  habitTimerGoal,
  isCounterElement,
  isHabitElement,
  PROTOCOL_VERSION,
  toDateString,
  type ActiveTimerSession,
  type DayEvent,
  type ElementDefinition,
  type HabitConfig,
  type HabitEventMeta,
  type LifeEvent,
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
import {
  pauseAtLastHeartbeat,
  TIMER_HEARTBEAT_MS,
  timerSessionFromMidnight,
  timerSessionParts,
  type TimerSessionPart,
} from '../protocol/timerSessionDays';

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
  /**
   * Done today only because Done was pressed short of the goal: the one kind
   * of done day the card offers to un-mark (seconds kept).
   */
  habitMarkedToday: Record<string, boolean>;
  habitStreaks: Record<string, number>;
  habitFailureStreaks: Record<string, number>;
  counterStreaks: Record<string, number>;
  activeTimerSessions: Record<string, ActiveTimerSession>;
  /**
   * The calendar day the day maps (totals, done, streaks) describe. Behind the
   * clock after a midnight nobody refreshed — `ensureCurrentDay` brings it up.
   */
  dayMapsDate: string;
  /** True after at least one successful habit day-state load this process. */
  dayStateReady: boolean;
  /** True after at least one successful counter totals load this process. */
  counterTotalsReady: boolean;
  /** Restore in-progress timers after process death (call once at bootstrap). */
  hydrateActiveTimerSessions: () => Promise<void>;
  /**
   * Note that this process is still running its timers. Called often (every
   * playback status update, foreground or locked); saves at most every
   * TIMER_HEARTBEAT_MS so a restart can tell where a dead session stopped.
   */
  recordTimerHeartbeat: () => void;
  /**
   * The day changed under a running session: log its seconds before midnight
   * onto the days they happened and keep it running for today. A session
   * paused before midnight is simply finished. Today's sessions are left alone.
   */
  rollHabitTimerOver: (elementId: string, config: HabitConfig) => Promise<void>;
  loadCounterTotals: (elementIds: string[]) => Promise<void>;
  loadCounterStreaks: (counters: CounterStreakInput[]) => Promise<void>;
  loadHabitDayState: (habits: HabitStreakInput[], date?: string) => Promise<void>;
  loadHabitStreaks: (habits: HabitStreakInput[]) => Promise<void>;
  /** Resolves to the inserted event's id, or null when an import/clear discarded the write. */
  logEvent: (
    elementId: string,
    value: number,
    meta?: Record<string, unknown>,
  ) => Promise<string | null>;
  /** Undo for counter taps: deletes exactly the events `logEvent` returned. */
  deleteCounterEvents: (elementId: string, eventIds: readonly string[]) => Promise<void>;
  setDailyTotal: (elementId: string, total: number, date?: string) => Promise<void>;
  toggleHabit: (elementId: string, config: HabitConfig, date?: string) => Promise<void>;
  /** Tick today unless SQLite says it is already done — never un-ticks. */
  completeHabit: (elementId: string, config: HabitConfig) => Promise<void>;
  startHabitTimer: (elementId: string, config: HabitConfig) => void;
  pauseHabitTimer: (elementId: string) => void;
  resumeHabitTimer: (elementId: string, config: HabitConfig) => void;
  stopHabitTimer: (
    elementId: string,
    config: HabitConfig,
    date?: string,
    options?: HabitTimerStopOptions,
  ) => Promise<void>;
  /**
   * Done on a timed habit before its goal: stops a running or paused session
   * (its seconds kept) and marks the day done, in one write. Resolves true
   * when the day is now done only because of that mark, so Undo is worth offering.
   */
  markHabitDone: (elementId: string, config: HabitConfig) => Promise<boolean>;
  /** Undo for `markHabitDone`: removes today's mark, keeps every logged second. */
  unmarkHabitDone: (elementId: string, config: HabitConfig) => Promise<void>;
  /** Drop an in-progress timer without writing an event (archive/delete). */
  discardHabitTimer: (elementId: string) => void;
  /** Clears the day and resolves to the events it removed, so Undo can put them back. */
  resetHabitToday: (elementId: string, config: HabitConfig, date?: string) => Promise<LifeEvent[]>;
  /** Undo for `resetHabitToday`: re-inserts what it removed, then reloads that day. */
  restoreHabitDay: (
    elementId: string,
    config: HabitConfig,
    events: LifeEvent[],
    date?: string,
  ) => Promise<void>;
}

function todayDate(): string {
  return currentAppCalendarDate();
}

function habitDayDone(config: HabitConfig, events: readonly DayEvent[]): boolean {
  return dayOutcome({ kind: 'habit', config }, dayFactsFromEvents(events)).done;
}

/** The mirror's view of a habit day: done, and whether only by the mark. */
function habitDayState(
  config: HabitConfig,
  events: readonly DayEvent[],
): { habitDone: boolean; habitMarked: boolean } {
  const outcome = dayOutcome({ kind: 'habit', config }, dayFactsFromEvents(events));
  return { habitDone: outcome.done, habitMarked: outcome.reason === 'marked_complete' };
}

function isManualComplete(event: DayEvent): boolean {
  return event.meta?.source === 'manual_complete';
}

/** A habit event whose meta the schema has checked, as every habit write must be. */
function habitEvent(
  elementId: string,
  date: string,
  value: number,
  meta: HabitEventMeta,
  timestamp = new Date().toISOString(),
): LifeEvent {
  return {
    id: newId(),
    elementId,
    timestamp,
    date,
    value,
    meta: HabitEventMetaSchema.parse(meta),
    protocolVersion: PROTOCOL_VERSION,
  };
}

/**
 * One timer_session event per day the session ran on, each carrying the goal
 * in force. The session's own start opens the first and the stop closes the
 * last; the parts in between end on the stroke of midnight.
 */
function timerPartEvents(
  elementId: string,
  config: HabitConfig,
  session: ActiveTimerSession,
  parts: readonly TimerSessionPart[],
  endedAt: Date,
  trackCompletedOnLast: boolean,
): LifeEvent[] {
  const goal = habitTimerGoal(config);
  return parts.map((part, index) => {
    const isFirst = index === 0;
    const isLast = index === parts.length - 1;
    const partStart = isFirst ? new Date(session.startedAt) : new Date(part.startMs);
    const partEnd = isLast ? endedAt : new Date(part.endMs - 1);
    const { meta } = buildTimerSessionPayloadFromDuration(partStart, partEnd, part.seconds, {
      trackCompleted: isLast && trackCompletedOnLast,
      ...(goal.type === 'seconds' ? { goalSeconds: goal.seconds } : {}),
    });
    return habitEvent(elementId, part.date, part.seconds, meta, partEnd.toISOString());
  });
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

interface HabitTimerStopOptions {
  trackCompleted?: boolean;
  playChime?: boolean;
  /** Done pressed before the goal: the stop also marks the day done. */
  markComplete?: boolean;
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
const habitTimerStopOptions = new Map<string, HabitTimerStopOptions>();
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

function enqueueCounterWrite<T>(
  elementId: string,
  work: (dataEpochAtStart: number, writeEpochAtStart: number) => Promise<T>,
): Promise<T> {
  const previous = counterWriteChains.get(elementId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const dataEpochAtStart = getDataGeneration('protocol');
    const writeEpochAtStart = getWriteEpoch(elementId);
    return work(dataEpochAtStart, writeEpochAtStart);
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
    if (element?.kind !== 'counter') return;
    const streak = await loadCounterStreakForElement(elementId, element.config, element.createdAt);
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
    /** Only read with `habitDone`; absent means the day is not done by the mark alone. */
    habitMarked: boolean;
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
      ? {
          habitDoneToday: { ...get().habitDoneToday, [elementId]: patch.habitDone },
          habitMarkedToday: {
            ...get().habitMarkedToday,
            [elementId]: patch.habitDone && (patch.habitMarked ?? false),
          },
        }
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

/**
 * When a running timer with a seconds goal reaches it, the day is done — for
 * the header, the list order, the lock-screen queue and the evening count, not
 * only the card that ticks every second. Each running session has at most one
 * pending crossing; pausing, stopping or discarding it cancels the crossing.
 */
const targetCrossings = new Map<string, ReturnType<typeof setTimeout>>();

function disarmTargetCrossing(elementId: string): void {
  const pending = targetCrossings.get(elementId);
  if (pending !== undefined) clearTimeout(pending);
  targetCrossings.delete(elementId);
}

function armTargetCrossing(
  elementId: string,
  config: HabitConfig,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): void {
  disarmTargetCrossing(elementId);
  const session = get().activeTimerSessions[elementId];
  const goal = habitTimerGoal(config);
  if (!session || session.pausedAt || config.trackingMode !== 'timer' || goal.type !== 'seconds') {
    return;
  }
  // The running session will record today's goal, so it is judged by it.
  const logged = session.calendarDate === get().dayMapsDate ? (get().dailyTotals[elementId] ?? 0) : 0;
  const remainingMs = (goal.seconds - logged) * 1000 - activeTimerElapsedMs(session);
  const markDone = () =>
    applyTodayMaps(elementId, session.calendarDate, { habitDone: true }, set, get);
  if (remainingMs <= 0) {
    markDone();
    return;
  }
  targetCrossings.set(
    elementId,
    setTimeout(() => {
      targetCrossings.delete(elementId);
      const current = get().activeTimerSessions[elementId];
      if (current?.startedAt === session.startedAt && !current.pausedAt) markDone();
    }, remainingMs),
  );
}

type HabitDayIntent =
  /** Tick, or un-tick a done day (a day done only by Done loses just that mark). */
  | 'toggle'
  /** Tick unless done: the lock-screen path, which must never un-tick. */
  | 'complete'
  /** Done on a timed habit: mark the day unless it is already done. */
  | 'mark'
  /** Undo of `mark`: remove the day's marks, keep its timer sessions. */
  | 'unmark';

function optimisticDay(
  intent: HabitDayIntent,
  mirrorDone: boolean,
  mirrorTotal: number,
): { habitDone: boolean; habitMarked?: boolean; dailyTotal: number } | null {
  switch (intent) {
    case 'toggle':
      return { habitDone: !mirrorDone, dailyTotal: mirrorDone ? 0 : 1 };
    case 'complete':
      return mirrorDone ? null : { habitDone: true, dailyTotal: 1 };
    case 'mark':
      return { habitDone: true, habitMarked: true, dailyTotal: mirrorTotal };
    case 'unmark':
      return { habitDone: false, dailyTotal: mirrorTotal };
    default: {
      const unknown: never = intent;
      throw new Error(`Unknown habit day intent: ${String(unknown)}`);
    }
  }
}

/** Apply `intent` to the day SQLite holds; resolves to the day's events after it. */
async function applyHabitDayIntent(
  intent: HabitDayIntent,
  elementId: string,
  config: HabitConfig,
  date: string,
): Promise<DayEvent[]> {
  const db = await getDatabase();
  // The mirror can be a day old (first lock-screen press after midnight)
  // or overtaken by a load, so what the day holds is read here.
  const existing = await eventRepo.getEventsForElementOnDate(db, elementId, date);
  const outcome = dayOutcome({ kind: 'habit', config }, dayFactsFromEvents(existing));
  const unmarked = existing.filter((event) => !isManualComplete(event));
  const add = async (meta: HabitEventMeta, value: number) => {
    const event = habitEvent(elementId, date, value, meta);
    await eventRepo.insertEvent(db, event);
    void playHabitCompleteHaptic();
    return [...existing, event];
  };

  switch (intent) {
    case 'toggle':
      if (!outcome.done) return add({ source: 'habit_tick' }, 1);
      if (outcome.reason === 'marked_complete') {
        await eventRepo.deleteManualCompleteMarkers(db, elementId, date);
        return unmarked;
      }
      await eventRepo.deleteEventsForElementOnDate(db, elementId, date);
      return [];
    case 'complete':
      return outcome.done ? existing : add({ source: 'habit_tick' }, 1);
    case 'mark':
      return outcome.done ? existing : add({ source: 'manual_complete' }, 0);
    case 'unmark':
      await eventRepo.deleteManualCompleteMarkers(db, elementId, date);
      return unmarked;
    default: {
      const unknown: never = intent;
      throw new Error(`Unknown habit day intent: ${String(unknown)}`);
    }
  }
}

/** One write to a habit's day. SQLite decides inside the lock; the mirror follows. */
async function writeHabitDay(
  intent: HabitDayIntent,
  elementId: string,
  config: HabitConfig,
  date: string,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): Promise<void> {
  if (habitToggleInFlight.has(elementId)) return;
  habitToggleInFlight.add(elementId);
  const dataEpochAtStart = getDataGeneration('protocol');
  const ourWriteEpoch = bumpWriteEpoch(elementId);

  // Instant feedback from the mirror; SQLite decides below, inside the lock.
  const mirrorDone = get().habitDoneToday[elementId] ?? false;
  const mirrorMarked = get().habitMarkedToday[elementId] ?? false;
  const mirrorTotal = get().dailyTotals[elementId] ?? 0;
  const optimistic = optimisticDay(intent, mirrorDone, mirrorTotal);
  if (optimistic) applyTodayMaps(elementId, date, optimistic, set, get);

  try {
    await withDbWriteLock(async () => {
      if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
        return;
      }
      const nextEvents = await applyHabitDayIntent(intent, elementId, config, date);

      if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
        return;
      }
      applyTodayMaps(
        elementId,
        date,
        { ...habitDayState(config, nextEvents), dailyTotal: sumEventValues(nextEvents) },
        set,
        get,
      );
      // A running timer already past its goal keeps the day done.
      armTargetCrossing(elementId, config, set, get);
      const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
      applyTodayMaps(elementId, date, { streak, failureStreak }, set, get);
    });
  } catch (error) {
    if (!eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
      applyTodayMaps(
        elementId,
        date,
        { habitDone: mirrorDone, habitMarked: mirrorMarked, dailyTotal: mirrorTotal },
        set,
        get,
      );
    }
    throw error;
  } finally {
    habitToggleInFlight.delete(elementId);
  }
}

/** True when the day is done, and only because Done was pressed. */
async function doneOnlyByMark(
  elementId: string,
  config: HabitConfig,
  date: string,
): Promise<boolean> {
  const db = await getDatabase();
  const events = await eventRepo.getEventsForElementOnDate(db, elementId, date);
  return dayOutcome({ kind: 'habit', config }, dayFactsFromEvents(events)).reason === 'marked_complete';
}

export const useEventStore = create<EventState>((set, get) => ({
  dailyTotals: {},
  habitDoneToday: {},
  habitMarkedToday: {},
  habitStreaks: {},
  habitFailureStreaks: {},
  counterStreaks: {},
  activeTimerSessions: {},
  dayMapsDate: todayDate(),
  dayStateReady: false,
  counterTotalsReady: false,

  reset: async () => {
    // The *Ready flags go back to false with the maps: the loaders that set
    // them true are what refills these, and until they run nothing here is
    // known — a screen must wait rather than read an empty map as "zero today".
    set({
      dailyTotals: {},
      habitDoneToday: {},
      habitMarkedToday: {},
      habitStreaks: {},
      habitFailureStreaks: {},
      counterStreaks: {},
      activeTimerSessions: {},
      dayMapsDate: todayDate(),
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
    const habitsById = new Map(elements.filter(isHabitElement).map((el) => [el.id, el]));
    const today = todayDate();
    const nowMs = Date.now();
    const kept: Record<string, ActiveTimerSession> = {};

    for (const [id, saved] of Object.entries(sessions)) {
      // The process that ran it is gone: nothing after its last heartbeat counts.
      const session = pauseAtLastHeartbeat(saved, nowMs);
      const element = habitsById.get(id);
      if (!element) {
        // Habit gone — drop orphaned persistence without inventing an event.
        console.warn('Dropping persisted timer for missing habit', id);
        continue;
      }

      if (session.calendarDate !== today) {
        // Cold start after midnight — finalize, each day getting its own seconds.
        set({
          activeTimerSessions: {
            ...get().activeTimerSessions,
            [id]: session,
          },
        });
        try {
          await get().stopHabitTimer(id, element.config);
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
        await get().stopHabitTimer(id, element.config);
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
    const firstHabit = firstId ? habitsById.get(firstId) : undefined;
    if (firstHabit) armTargetCrossing(firstHabit.id, firstHabit.config, set, get);
  },

  recordTimerHeartbeat: () => {
    const nowMs = Date.now();
    const sessions = get().activeTimerSessions;
    let changed = false;
    const next: Record<string, ActiveTimerSession> = {};
    for (const [id, session] of Object.entries(sessions)) {
      const due =
        !session.pausedAt &&
        (!session.heartbeatAt || nowMs - new Date(session.heartbeatAt).getTime() >= TIMER_HEARTBEAT_MS);
      next[id] = due ? { ...session, heartbeatAt: new Date(nowMs).toISOString() } : session;
      changed ||= due;
    }
    if (!changed) return;
    set({ activeTimerSessions: next });
    schedulePersistActiveTimers(next);
  },

  rollHabitTimerOver: async (elementId, config) => {
    await habitTimerStopPromises.get(elementId);
    const session = get().activeTimerSessions[elementId];
    const today = todayDate();
    if (!session || session.calendarDate === today) return;
    const midnightMs = startOfToday();
    if (session.pausedAt && new Date(session.pausedAt).getTime() < midnightMs) {
      await get().stopHabitTimer(elementId, config);
      return;
    }

    const dataEpochAtStart = getDataGeneration('protocol');
    const nowMs = Date.now();
    const past = timerSessionParts(session, nowMs).filter((part) => part.date < today);
    const rolled = timerSessionFromMidnight(session, nowMs);
    const swap = (from: ActiveTimerSession, to: ActiveTimerSession) => {
      if (get().activeTimerSessions[elementId] !== from) return;
      const nextSessions = { ...get().activeTimerSessions, [elementId]: to };
      set({ activeTimerSessions: nextSessions });
      schedulePersistActiveTimers(nextSessions);
      armTargetCrossing(elementId, config, set, get);
    };

    swap(session, rolled);
    if (past.length === 0) return;
    try {
      await withDbWriteLock(async () => {
        if (dataEpochAtStart !== getDataGeneration('protocol')) return;
        const lastMoment = new Date(midnightMs - 1);
        const events = timerPartEvents(elementId, config, session, past, lastMoment, false);
        const db = await getDatabase();
        await db.withTransactionAsync(async () => {
          for (const event of events) {
            await eventRepo.insertEvent(db, event);
          }
        });
      });
    } catch (error) {
      // Nothing was logged: put the whole session back so no second is lost.
      swap(rolled, session);
      throw error;
    }
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
    const factsByElement = await eventRepo.getDayFactsForElementsOnDate(
      db,
      habits.map((h) => h.id),
      date,
    );

    const totals: Record<string, number> = {};
    const status: Record<string, boolean> = {};
    const marked: Record<string, boolean> = {};
    for (const { id, config } of habits) {
      const outcome = dayOutcome(
        { kind: 'habit', config },
        factsByElement.get(id) ?? factsFromTotal(0),
      );
      totals[id] = outcome.total;
      status[id] = outcome.done;
      marked[id] = outcome.reason === 'marked_complete';
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
      habitMarkedToday: {
        ...get().habitMarkedToday,
        ...mergeUnchangedEntries(marked, epochs),
      },
      dayStateReady: true,
    });
    // SQLite has not seen a running session's seconds; one past its goal is done.
    for (const { id, config } of habits) armTargetCrossing(id, config, set, get);
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
      if (eventWriteSuperseded(dataEpochAtStart, elementId, writeEpochAtStart)) return null;
      const ourWriteEpoch = bumpWriteEpoch(elementId);
      let insertedId: string | null = null;
      let wrote = false;
      await withDbWriteLock(async () => {
        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        const now = new Date();
        const date = toDateString(now);
        const id = newId();
        await eventRepo.insertEvent(await getDatabase(), {
          id,
          elementId,
          timestamp: now.toISOString(),
          date,
          value,
          meta,
          protocolVersion: PROTOCOL_VERSION,
        });
        insertedId = id;

        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        await refreshTotal(elementId, date, set, get);
        wrote = true;
      });
      if (wrote) await refreshCounterStreakAfterWrite(elementId, set, get);
      return insertedId;
    }),

  deleteCounterEvents: (elementId, eventIds) =>
    enqueueCounterWrite(elementId, async (dataEpochAtStart, writeEpochAtStart) => {
      if (eventWriteSuperseded(dataEpochAtStart, elementId, writeEpochAtStart)) return;
      const ourWriteEpoch = bumpWriteEpoch(elementId);
      let wrote = false;
      await withDbWriteLock(async () => {
        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        await eventRepo.deleteEventsByIds(await getDatabase(), elementId, eventIds);

        if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
          return;
        }
        await refreshTotal(elementId, todayDate(), set, get);
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

  toggleHabit: (elementId, config, date = todayDate()) =>
    writeHabitDay('toggle', elementId, config, date, set, get),

  completeHabit: (elementId, config) =>
    writeHabitDay('complete', elementId, config, todayDate(), set, get),

  markHabitDone: async (elementId, config) => {
    const session = get().activeTimerSessions[elementId];
    if (session) {
      await get().stopHabitTimer(elementId, config, undefined, { markComplete: true });
      return doneOnlyByMark(elementId, config, session.calendarDate);
    }
    // A stop already under way (rollover, a natural end) lands first.
    await awaitHabitTimerStop(elementId);
    const date = todayDate();
    await writeHabitDay('mark', elementId, config, date, set, get);
    return doneOnlyByMark(elementId, config, date);
  },

  unmarkHabitDone: (elementId, config) =>
    writeHabitDay('unmark', elementId, config, todayDate(), set, get),

  startHabitTimer: (elementId, config) => {
    if (get().activeTimerSessions[elementId]) return;
    const activeTimerSessions = {
      ...get().activeTimerSessions,
      [elementId]: { ...createActiveTimerSession(), heartbeatAt: new Date().toISOString() },
    };
    set({ activeTimerSessions });
    schedulePersistActiveTimers(activeTimerSessions);
    armTargetCrossing(elementId, config, set, get);
  },

  pauseHabitTimer: (elementId) => {
    const session = get().activeTimerSessions[elementId];
    if (!session || session.pausedAt) return;
    disarmTargetCrossing(elementId);

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

  resumeHabitTimer: (elementId, config) => {
    const session = get().activeTimerSessions[elementId];
    if (!session?.pausedAt) return;

    // A clock set backwards while paused would make this negative, and a negative
    // offset fails validation when sessions are read back — dropping all of them.
    const pausedMs = Math.max(0, Date.now() - new Date(session.pausedAt).getTime());
    const activeTimerSessions = {
      ...get().activeTimerSessions,
      [elementId]: {
        ...session,
        pausedAt: null,
        pauseOffsetMs: session.pauseOffsetMs + pausedMs,
        heartbeatAt: new Date().toISOString(),
      },
    };
    set({ activeTimerSessions });
    schedulePersistActiveTimers(activeTimerSessions);
    armTargetCrossing(elementId, config, set, get);
  },

  stopHabitTimer: (elementId, config, _date, options) => {
    const existing = habitTimerStopPromises.get(elementId);
    if (existing) {
      // Only ever add to what the running stop will write.
      const merged = { ...habitTimerStopOptions.get(elementId) };
      if (options?.trackCompleted) merged.trackCompleted = true;
      if (options?.playChime) merged.playChime = true;
      if (options?.markComplete) merged.markComplete = true;
      habitTimerStopOptions.set(elementId, merged);
      return existing;
    }

    habitTimerStopOptions.set(elementId, { ...options });
    disarmTargetCrossing(elementId);

    const promise = (async () => {
      const session = get().activeTimerSessions[elementId];
      if (!session) return;

      const dataEpochAtStart = getDataGeneration('protocol');
      const ourWriteEpoch = bumpWriteEpoch(elementId);

      const endedAt = new Date();
      // Each day the session ran on gets the seconds that happened on it. The
      // day it ended carries the mark, the track-completed flag and the mirror.
      // Options only change the meta; the seconds are fixed at the moment of the stop.
      const parts = timerSessionParts(session, endedAt.getTime());
      const lastPart = parts[parts.length - 1]!;
      const persistDate = lastPart.date;
      const value = lastPart.seconds;
      const mirrorTotal = get().dailyTotals[elementId] ?? 0;

      // Clear session immediately so double-taps can't double-insert.
      const nextSessions = { ...get().activeTimerSessions };
      delete nextSessions[elementId];
      set({ activeTimerSessions: nextSessions });
      schedulePersistActiveTimers(nextSessions);
      applyTodayMaps(elementId, persistDate, { dailyTotal: mirrorTotal + value }, set, get);

      try {
        await withDbWriteLock(async () => {
          // Only an import/clear abandons the insert. A newer write to this habit
          // (Undo, a tick) is not a reason to drop the session's seconds; it only
          // means this stop must not patch the mirror afterwards.
          if (dataEpochAtStart !== getDataGeneration('protocol')) {
            return;
          }

          // Read now, not at the start: a stop that joined while this one waited
          // (a play-once track ending after Done) may have added trackCompleted.
          const stopOpts = habitTimerStopOptions.get(elementId);
          const partEvents = timerPartEvents(
            elementId,
            config,
            session,
            parts,
            endedAt,
            stopOpts?.trackCompleted === true,
          );
          const sessionEvent = partEvents[partEvents.length - 1]!;
          const db = await getDatabase();
          const existingEvents = await eventRepo.getEventsForElementOnDate(
            db,
            elementId,
            persistDate,
          );
          // The mirror may not hold this day yet (cold start) — SQLite does.
          const previousTotal = sumEventValues(existingEvents);
          const nextTotal = previousTotal + value;
          const withSession = [...existingEvents, sessionEvent];
          // Done before the goal: the same write marks the day.
          const mark =
            stopOpts?.markComplete && !habitDayDone(config, withSession)
              ? habitEvent(elementId, persistDate, 0, { source: 'manual_complete' }, endedAt.toISOString())
              : null;
          const nextEvents = mark ? [...withSession, mark] : withSession;
          const wasComplete = habitDayDone(config, existingEvents);
          const isComplete = habitDayDone(config, nextEvents);

          if (dataEpochAtStart !== getDataGeneration('protocol')) {
            return;
          }

          await db.withTransactionAsync(async () => {
            for (const event of [...partEvents.slice(0, -1), ...nextEvents.slice(existingEvents.length)]) {
              await eventRepo.insertEvent(db, event);
            }
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
            { dailyTotal: nextTotal, ...habitDayState(config, nextEvents), streak, failureStreak },
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
        armTargetCrossing(elementId, config, set, get);
        applyTodayMaps(elementId, persistDate, { dailyTotal: mirrorTotal }, set, get);
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
    disarmTargetCrossing(elementId);
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
    let removed: LifeEvent[] = [];
    await withDbWriteLock(async () => {
      if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) {
        return;
      }
      const db = await getDatabase();
      removed = await eventRepo.getEventsForElementOnDate(db, elementId, date);
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
    return removed;
  },

  restoreHabitDay: async (elementId, config, events, date = todayDate()) => {
    if (events.length === 0) return;
    const dataEpochAtStart = getDataGeneration('protocol');
    const ourWriteEpoch = bumpWriteEpoch(elementId);
    await withDbWriteLock(async () => {
      if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) return;
      const db = await getDatabase();
      // Only today's own events, and only into a day nothing was logged on since:
      // a timer started after the reset is newer than the Undo and wins.
      const since = await eventRepo.getEventsForElementOnDate(db, elementId, date);
      if (since.length > 0) return;
      await db.withTransactionAsync(async () => {
        for (const event of events) {
          if (event.elementId === elementId && event.date === date) {
            await eventRepo.insertEvent(db, event);
          }
        }
      });
      if (eventWriteSuperseded(dataEpochAtStart, elementId, ourWriteEpoch)) return;
      const total = sumEventValues(events);
      applyTodayMaps(
        elementId,
        date,
        { dailyTotal: total, ...habitDayState(config, events) },
        set,
        get,
      );
      try {
        const { streak, failureStreak } = await loadHabitStreakForElement(elementId, config);
        applyTodayMaps(elementId, date, { streak, failureStreak }, set, get);
      } catch {
        // Day restored; streaks can refresh on next focus.
      }
    });
  },
}));

export function habitStreakInputsFromElements(
  elements: readonly ElementDefinition[],
): HabitStreakInput[] {
  return elements
    .filter(isHabitElement)
    .map((e) => ({ id: e.id, config: e.config, createdAt: e.createdAt ?? null }));
}

/** Inputs for target-hit streak loads; a counter without a target has no streak. */
export function counterStreakInputsFromElements(
  elements: readonly ElementDefinition[],
): CounterStreakInput[] {
  return elements
    .filter(isCounterElement)
    .map((e) => ({ id: e.id, config: e.config, createdAt: e.createdAt ?? null }));
}
