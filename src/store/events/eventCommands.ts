import { newId } from '../../utils/id';
import {
  buildTimerSessionPayloadFromDuration,
  dayFactsFromEvents,
  dayOutcome,
  HabitEventMetaSchema,
  habitTimerGoal,
  PROTOCOL_VERSION,
  toDateString,
  type ActiveTimerSession,
  type DayEvent,
  type HabitConfig,
  type HabitEventMeta,
  type LifeEvent,
} from '../../protocol';
import { playHabitCompleteChime } from '../../audio/habitCompleteSound';
import { playHabitCompleteHaptic } from '../../utils/habitHaptics';
import { getDatabase } from '../../db/client';
import * as eventRepo from '../../db/repositories/eventRepository';
import { withGuardedWrite } from '../../db/dataGeneration';
import {
  timerSessionFromMidnight,
  timerSessionParts,
  type TimerSessionPart,
} from '../../protocol/timerSessionDays';
import { applyTodayMaps, armTargetCrossing, disarmTargetCrossing, requeryElementDay } from './dayMirror';
import { schedulePersistActiveTimers } from './timerPersistence';
import {
  todayDate,
  type EventState,
  type GetEventState,
  type HabitTimerStopOptions,
  type SetEventState,
} from './state';

/**
 * Event commands: each takes the write lock, writes, and re-reads the day it
 * touched. What the screen shows afterwards is what SQLite holds.
 */

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

/** True while any timer stop is still writing its seconds. */
export function isAnyHabitTimerStopping(): boolean {
  return habitTimerStopPromises.size > 0;
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
  set: SetEventState,
  get: GetEventState,
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

type EventCommands = Pick<
  EventState,
  | 'rollHabitTimerOver'
  | 'logEvent'
  | 'deleteCounterEvents'
  | 'setDailyTotal'
  | 'toggleHabit'
  | 'completeHabit'
  | 'markHabitDone'
  | 'unmarkHabitDone'
  | 'stopHabitTimer'
  | 'resetHabitToday'
  | 'restoreHabitDay'
>;

export function createEventCommands(set: SetEventState, get: GetEventState): EventCommands {
  return {
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
  };
}
