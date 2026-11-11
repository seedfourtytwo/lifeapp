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
import { playHabitCompleteHaptic } from '../utils/habitHaptics';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { getDatabase } from '../db/client';
import * as eventRepo from '../db/repositories/eventRepository';
import * as elementRepo from '../db/repositories/elementRepository';
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
import type { ResettableMirror } from './mirrorReset';
import { withGuardedWrite } from '../db/dataGeneration';
import {
  pauseAtLastHeartbeat,
  TIMER_HEARTBEAT_MS,
  timerSessionFromMidnight,
  timerSessionParts,
  type TimerSessionPart,
} from '../protocol/timerSessionDays';

export type { HabitStreakInput, CounterStreakInput };

let persistTimersChain: Promise<void> = Promise.resolve();
/** Bumped on every save, so a read of the saved form can tell it was overtaken. */
let persistTimersSeq = 0;

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
  persistTimersSeq += 1;
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
   * Adopt the sessions as saved in SQLite, in a live process: unlike the cold
   * start hydrate nothing is paused or finished. A save still on its way wins
   * over what was read, since it is newer.
   */
  reloadActiveTimerSessions: () => Promise<void>;
  /**
   * The sound playing for this habit's session is still going. Called on every
   * playback status update, foreground or locked; saves at most every
   * TIMER_HEARTBEAT_MS so a restart can tell where a dead session stopped.
   * Only the session the sound belongs to is stamped: a heartbeat must never
   * stand for a session nothing was actually watching.
   */
  recordTimerHeartbeat: (elementId: string) => void;
  /**
   * The sound stopped while a session runs on (a play-once track that ended
   * short of a minutes goal). With no source left, the heartbeat goes, so a
   * restart counts the session by the clock instead of cutting it at the end
   * of the track.
   */
  clearTimerHeartbeats: () => void;
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

/**
 * Every read of today's state, whether a bulk load or the re-query after a
 * write, runs here one at a time in the order asked for, and applies what it
 * read before the next starts. A read asked for after a write committed can
 * therefore only be followed by reads that saw at least as much, so no older
 * result ever lands over a newer one.
 */
let mirrorReads: Promise<unknown> = Promise.resolve();

function inMirrorOrder<T>(read: () => Promise<T>): Promise<T> {
  const next = mirrorReads.catch(() => undefined).then(read);
  mirrorReads = next.catch(() => undefined);
  return next;
}

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

function enqueueCounterWrite<T>(elementId: string, work: () => Promise<T>): Promise<T> {
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

/**
 * Re-read one tracker's today from SQLite — its definition, total, done state
 * and streak — and show that. Every event write ends here, failed or not, so
 * the screen shows what the database holds and nothing else.
 */
function requeryElementDay(
  elementId: string,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): Promise<void> {
  return inMirrorOrder(async () => {
    const db = await getDatabase();
    const element = await elementRepo.getElementById(db, elementId);
    if (!element) return;
    const date = todayDate();
    const facts =
      (await eventRepo.getDayFactsForElementsOnDate(db, [elementId], date)).get(elementId) ??
      factsFromTotal(0);
    if (isHabitElement(element)) {
      const outcome = dayOutcome(element, facts);
      const { streak, failureStreak } = await loadHabitStreakForElement(
        elementId,
        element.config,
        element.createdAt ?? null,
      );
      applyTodayMaps(
        elementId,
        date,
        {
          dailyTotal: outcome.total,
          habitDone: outcome.done,
          habitMarked: outcome.reason === 'marked_complete',
          streak,
          failureStreak,
        },
        set,
        get,
      );
      // A running timer already past its goal keeps the day done.
      armTargetCrossing(elementId, element.config, set, get);
      return;
    }
    if (isCounterElement(element)) {
      const streak = await loadCounterStreakForElement(
        elementId,
        element.config,
        element.createdAt ?? null,
      );
      if (date !== todayDate()) return;
      set({
        dailyTotals: { ...get().dailyTotals, [elementId]: facts.total },
        counterStreaks: { ...get().counterStreaks, [elementId]: streak },
      });
    }
  });
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

/** Apply `intent` to the day SQLite holds. */
async function applyHabitDayIntent(
  intent: HabitDayIntent,
  elementId: string,
  config: HabitConfig,
  date: string,
): Promise<void> {
  const db = await getDatabase();
  // What the day holds is read here, inside the lock: the screen can be a day
  // old (first lock-screen press after midnight) or a write behind.
  const existing = await eventRepo.getEventsForElementOnDate(db, elementId, date);
  const outcome = dayOutcome({ kind: 'habit', config }, dayFactsFromEvents(existing));
  const add = async (meta: HabitEventMeta, value: number) => {
    await eventRepo.insertEvent(db, habitEvent(elementId, date, value, meta));
    void playHabitCompleteHaptic();
  };

  switch (intent) {
    case 'toggle':
      if (!outcome.done) return add({ source: 'habit_tick' }, 1);
      if (outcome.reason === 'marked_complete') {
        return eventRepo.deleteManualCompleteMarkers(db, elementId, date);
      }
      return eventRepo.deleteEventsForElementOnDate(db, elementId, date);
    case 'complete':
      return outcome.done ? undefined : add({ source: 'habit_tick' }, 1);
    case 'mark':
      return outcome.done ? undefined : add({ source: 'manual_complete' }, 0);
    case 'unmark':
      return eventRepo.deleteManualCompleteMarkers(db, elementId, date);
    default: {
      const unknown: never = intent;
      throw new Error(`Unknown habit day intent: ${String(unknown)}`);
    }
  }
}

/** One write to a habit's day: SQLite decides inside the lock, then the day is re-read. */
async function writeHabitDay(
  intent: HabitDayIntent,
  elementId: string,
  config: HabitConfig,
  date: string,
  set: (partial: Partial<EventState>) => void,
  get: () => EventState,
): Promise<void> {
  // A second tap while the first is still writing is the same tap.
  if (habitToggleInFlight.has(elementId)) return;
  habitToggleInFlight.add(elementId);
  try {
    await withGuardedWrite('protocol', () => applyHabitDayIntent(intent, elementId, config, date));
  } finally {
    habitToggleInFlight.delete(elementId);
    await requeryElementDay(elementId, set, get);
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

  reloadActiveTimerSessions: async () => {
    // Before the cold-start hydrate, saved sessions may be from a dead process.
    if (!activeTimersReady) return;
    await persistTimersChain;
    const seqAtRead = persistTimersSeq;
    const saved = await loadPersistedActiveTimerSessions(await getDatabase());
    if (seqAtRead !== persistTimersSeq || habitTimerStopPromises.size > 0) return;
    const current = get().activeTimerSessions;
    if (JSON.stringify(saved) === JSON.stringify(current)) return;

    for (const id of Object.keys(current)) {
      if (!saved[id]) disarmTargetCrossing(id);
    }
    set({ activeTimerSessions: saved });
    const { useElementStore } = await import('./elementStore');
    for (const element of useElementStore.getState().elements.filter(isHabitElement)) {
      if (saved[element.id]) armTargetCrossing(element.id, element.config, set, get);
    }
  },

  recordTimerHeartbeat: (elementId) => {
    const nowMs = Date.now();
    const session = get().activeTimerSessions[elementId];
    if (!session || session.pausedAt) return;
    if (session.heartbeatAt && nowMs - new Date(session.heartbeatAt).getTime() < TIMER_HEARTBEAT_MS) {
      return;
    }
    const next = {
      ...get().activeTimerSessions,
      [elementId]: { ...session, heartbeatAt: new Date(nowMs).toISOString() },
    };
    set({ activeTimerSessions: next });
    schedulePersistActiveTimers(next);
  },

  clearTimerHeartbeats: () => {
    const sessions = get().activeTimerSessions;
    if (!Object.values(sessions).some((session) => session.heartbeatAt)) return;
    const next = Object.fromEntries(
      Object.entries(sessions).map(([id, { heartbeatAt: _dropped, ...session }]) => [id, session]),
    );
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
      await withGuardedWrite('protocol', async () => {
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

  loadCounterTotals: (elementIds) =>
    inMirrorOrder(async () => {
      if (elementIds.length === 0) {
        set({ counterTotalsReady: true });
        return;
      }
      const totals = await eventRepo.getDailyTotalsForElementsOnDate(
        await getDatabase(),
        elementIds,
        todayDate(),
      );
      set({
        dailyTotals: { ...get().dailyTotals, ...Object.fromEntries(totals) },
        counterTotalsReady: true,
      });
    }),

  loadCounterStreaks: (counters) =>
    inMirrorOrder(async () => {
      if (counters.length === 0) return;
      const streaks = await loadCounterStreakMaps(counters);
      set({ counterStreaks: { ...get().counterStreaks, ...streaks } });
    }),

  loadHabitDayState: (habits, date = todayDate()) =>
    inMirrorOrder(async () => {
      if (habits.length === 0) {
        set({ dayStateReady: true });
        return;
      }
      const factsByElement = await eventRepo.getDayFactsForElementsOnDate(
        await getDatabase(),
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

      set({
        dailyTotals: { ...get().dailyTotals, ...totals },
        habitDoneToday: { ...get().habitDoneToday, ...status },
        habitMarkedToday: { ...get().habitMarkedToday, ...marked },
        dayStateReady: true,
      });
      // SQLite has not seen a running session's seconds; one past its goal is done.
      for (const { id, config } of habits) armTargetCrossing(id, config, set, get);
    }),

  loadHabitStreaks: (habits) =>
    inMirrorOrder(async () => {
      if (habits.length === 0) return;
      const { streaks, failureStreaks } = await loadHabitStreakMaps(habits);
      set({
        habitStreaks: { ...get().habitStreaks, ...streaks },
        habitFailureStreaks: { ...get().habitFailureStreaks, ...failureStreaks },
      });
    }),

  logEvent: (elementId, value, meta) =>
    enqueueCounterWrite(elementId, async () => {
      try {
        const inserted = await withGuardedWrite('protocol', async () => {
          const now = new Date();
          const id = newId();
          await eventRepo.insertEvent(await getDatabase(), {
            id,
            elementId,
            timestamp: now.toISOString(),
            date: toDateString(now),
            value,
            meta,
            protocolVersion: PROTOCOL_VERSION,
          });
          return id;
        });
        return inserted ?? null;
      } finally {
        await requeryElementDay(elementId, set, get);
      }
    }),

  deleteCounterEvents: (elementId, eventIds) =>
    enqueueCounterWrite(elementId, async () => {
      try {
        await withGuardedWrite('protocol', async () =>
          eventRepo.deleteEventsByIds(await getDatabase(), elementId, eventIds),
        );
      } finally {
        await requeryElementDay(elementId, set, get);
      }
    }),

  setDailyTotal: (elementId, total, date = todayDate()) =>
    enqueueCounterWrite(elementId, async () => {
      if (total < 0 || !Number.isFinite(total)) {
        throw new Error('Total must be a non-negative number');
      }
      try {
        await withGuardedWrite('protocol', async () =>
          eventRepo.setDailyTotalForElement(await getDatabase(), elementId, date, total, {
            id: newId(),
            timestamp: new Date().toISOString(),
            meta: { source: 'manual' },
          }),
        );
      } finally {
        await requeryElementDay(elementId, set, get);
      }
    }),

  toggleHabit: (elementId, config, date = todayDate()) =>
    writeHabitDay('toggle', elementId, config, date, set, get),

  completeHabit: (elementId, config) =>
    writeHabitDay('complete', elementId, config, todayDate(), set, get),

  markHabitDone: async (elementId, config) => {
    const session = get().activeTimerSessions[elementId];
    if (session) {
      // The mark goes on the day the session ends, which is not its start day after midnight.
      const endDay = timerSessionParts(session, Date.now()).at(-1)?.date ?? session.calendarDate;
      await get().stopHabitTimer(elementId, config, undefined, { markComplete: true });
      return doneOnlyByMark(elementId, config, endDay);
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
      [elementId]: createActiveTimerSession(),
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
    // The heartbeat from before the pause goes: until the sound reports again,
    // a restart must not mistake the pause for the moment the process died.
    const { heartbeatAt: _beforePause, ...unpaused } = session;
    const activeTimerSessions = {
      ...get().activeTimerSessions,
      [elementId]: {
        ...unpaused,
        pausedAt: null,
        pauseOffsetMs: session.pauseOffsetMs + pausedMs,
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

      const endedAt = new Date();
      // Each day the session ran on gets the seconds that happened on it. The
      // day it ended carries the mark and the track-completed flag. Options
      // only change the meta; the seconds are fixed at the moment of the stop.
      const parts = timerSessionParts(session, endedAt.getTime());
      const lastPart = parts[parts.length - 1]!;
      const persistDate = lastPart.date;

      // Clear the session at once so a second tap cannot log it twice. Its
      // seconds leave the clock now and reach SQLite a moment later; the one
      // patch below carries them across so the card's total does not dip.
      const nextSessions = { ...get().activeTimerSessions };
      delete nextSessions[elementId];
      set({ activeTimerSessions: nextSessions });
      schedulePersistActiveTimers(nextSessions);
      const shownTotal = get().dailyTotals[elementId] ?? 0;
      applyTodayMaps(elementId, persistDate, { dailyTotal: shownTotal + lastPart.seconds }, set, get);

      try {
        // Only an import/clear abandons the insert. A newer write to this habit
        // (Undo, a tick) is not a reason to drop the session's seconds.
        await withGuardedWrite('protocol', async () => {
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
          const db = await getDatabase();
          const existingEvents = await eventRepo.getEventsForElementOnDate(
            db,
            elementId,
            persistDate,
          );
          const withSession = [...existingEvents, partEvents[partEvents.length - 1]!];
          // Done before the goal: the same write marks the day.
          const mark =
            stopOpts?.markComplete && !habitDayDone(config, withSession)
              ? habitEvent(elementId, persistDate, 0, { source: 'manual_complete' }, endedAt.toISOString())
              : null;
          const nextEvents = mark ? [...withSession, mark] : withSession;

          await db.withTransactionAsync(async () => {
            for (const event of mark ? [...partEvents, mark] : partEvents) {
              await eventRepo.insertEvent(db, event);
            }
          });

          // Target-crossing chime plays live in HabitTimerWidget.
          // Natural play-once end sets playChime; manual Done must not chime.
          if (stopOpts?.playChime) {
            void playHabitCompleteChime();
          }
          if (!habitDayDone(config, existingEvents) && habitDayDone(config, nextEvents)) {
            void playHabitCompleteHaptic();
          }
        });
      } catch (error) {
        if (!habitTimerStopAbortRestore.has(elementId)) {
          const restored = { ...get().activeTimerSessions, [elementId]: session };
          set({ activeTimerSessions: restored });
          schedulePersistActiveTimers(restored);
        }
        throw error;
      } finally {
        await requeryElementDay(elementId, set, get);
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

    try {
      const removed = await withGuardedWrite('protocol', async () => {
        const db = await getDatabase();
        const events = await eventRepo.getEventsForElementOnDate(db, elementId, date);
        await eventRepo.deleteEventsForElementOnDate(db, elementId, date);
        return events;
      });
      if (removed) get().discardHabitTimer(elementId);
      return removed ?? [];
    } finally {
      await requeryElementDay(elementId, set, get);
    }
  },

  restoreHabitDay: async (elementId, _config, events, date = todayDate()) => {
    if (events.length === 0) return;
    try {
      await withGuardedWrite('protocol', async () => {
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
      });
    } finally {
      await requeryElementDay(elementId, set, get);
    }
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
