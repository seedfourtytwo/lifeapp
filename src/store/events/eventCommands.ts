import { derivedId, newId } from '../../utils/id';
import {
  buildTimerSessionPayloadFromDuration,
  dayFactsFromEvents,
  dayOutcome,
  HabitEventMetaSchema,
  PROTOCOL_VERSION,
  toDateString,
  type ActiveTimerSession,
  type DayEvent,
  type HabitConfig,
  type HabitEventMeta,
  type LifeEvent,
} from '../../protocol';
import type { TimerSessionRecord } from '../../protocol/coreTimer';
import { playHabitCompleteHaptic } from '../../utils/habitHaptics';
import { getDatabase } from '../../db/client';
import * as eventRepo from '../../db/repositories/eventRepository';
import { withGuardedWrite } from '../../db/dataGeneration';
import { timerSessionParts } from '../../protocol/timerSessionDays';
import { requeryElementDay } from './dayMirror';
import { todayDate, type EventState, type GetEventState, type SetEventState } from './state';

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
 * The events a finished native session becomes: one per day it ran on, each
 * under an id derived from the record's id and that day.
 */
function recordPartEvents(elementId: string, record: TimerSessionRecord): LifeEvent[] {
  const startedMs = new Date(record.startedAt).getTime();
  const session: ActiveTimerSession = {
    startedAt: record.startedAt,
    pausedAt: null,
    pauseOffsetMs: record.pausedMs,
    calendarDate: toDateString(new Date(startedMs)),
  };
  const endedAt = new Date(record.endedAt);
  const parts = timerSessionParts(session, endedAt.getTime());
  return parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    const partStart = index === 0 ? new Date(startedMs) : new Date(part.startMs);
    const partEnd = isLast ? endedAt : new Date(part.endMs - 1);
    const { meta } = buildTimerSessionPayloadFromDuration(partStart, partEnd, part.seconds, {
      trackCompleted: isLast && record.trackCompleted,
      ...(record.goalSecondsInForce === null ? {} : { goalSeconds: record.goalSecondsInForce }),
    });
    return {
      ...habitEvent(elementId, part.date, part.seconds, meta, partEnd.toISOString()),
      id: derivedId(record.id, part.date, 'session'),
    };
  });
}

const habitToggleInFlight = new Set<string>();
/** Serialize counter log/set-total so edit + quick-add can't interleave. */
const counterWriteChains = new Map<string, Promise<void>>();
/** Drain in-flight counter writes and habit toggles before a destructive wipe. */
export async function awaitPendingEventWrites(): Promise<void> {
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
  const counterPending = counterWriteChains.get(elementId);
  if (counterPending) await Promise.allSettled([counterPending]);
  const deadline = Date.now() + 2_000;
  while (habitToggleInFlight.has(elementId) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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
  | 'applyTimerSession'
  | 'logEvent'
  | 'deleteCounterEvents'
  | 'setDailyTotal'
  | 'toggleHabit'
  | 'completeHabit'
  | 'markHabitDone'
  | 'isHabitDayDoneOnlyByMark'
  | 'unmarkHabitDone'
  | 'resetHabitToday'
  | 'restoreHabitDay'
>;

export function createEventCommands(set: SetEventState, get: GetEventState): EventCommands {
  return {
    applyTimerSession: async (elementId, config, record) => {
      try {
        await withGuardedWrite('protocol', async () => {
          const db = await getDatabase();
          const partEvents = recordPartEvents(elementId, record);
          const last = partEvents[partEvents.length - 1]!;
          const before = await eventRepo.getEventsForElementOnDate(db, elementId, last.date);
          const sessionIsNew = !(await eventRepo.eventExists(db, last.id));
          const withSession = sessionIsNew ? [...before, last] : before;
          const markId = derivedId(record.id, last.date, 'mark');
          const mark =
            record.markComplete &&
            !habitDayDone(config, withSession) &&
            !(await eventRepo.eventExists(db, markId))
              ? {
                  ...habitEvent(elementId, last.date, 0, { source: 'manual_complete' }, record.at),
                  id: markId,
                }
              : null;
          const after = mark ? [...withSession, mark] : withSession;

          await db.withTransactionAsync(async () => {
            for (const event of mark ? [...partEvents, mark] : partEvents) {
              if (!(await eventRepo.eventExists(db, event.id))) await eventRepo.insertEvent(db, event);
            }
          });
          if (!habitDayDone(config, before) && habitDayDone(config, after)) {
            void playHabitCompleteHaptic();
          }
        });
      } finally {
        await requeryElementDay(elementId, set, get);
      }
    },

    logEvent: (elementId, value, meta, logged) =>
      enqueueCounterWrite(elementId, async () => {
        try {
          const inserted = await withGuardedWrite('protocol', async () => {
            const db = await getDatabase();
            if (logged && (await eventRepo.eventExists(db, logged.id))) return logged.id;
            const now = new Date();
            const id = logged?.id ?? newId();
            await eventRepo.insertEvent(db, {
              id,
              elementId,
              timestamp: logged?.timestamp ?? now.toISOString(),
              date: logged?.date ?? toDateString(now),
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

    completeHabit: (elementId, config, date = todayDate()) =>
      writeHabitDay('complete', elementId, config, date, set, get),

    markHabitDone: async (elementId, config) => {
      const date = todayDate();
      await writeHabitDay('mark', elementId, config, date, set, get);
      return doneOnlyByMark(elementId, config, date);
    },

    isHabitDayDoneOnlyByMark: doneOnlyByMark,

    unmarkHabitDone: (elementId, config) =>
      writeHabitDay('unmark', elementId, config, todayDate(), set, get),

    resetHabitToday: async (elementId, _config, date = todayDate()) => {
      try {
        const removed = await withGuardedWrite('protocol', async () => {
          const db = await getDatabase();
          const events = await eventRepo.getEventsForElementOnDate(db, elementId, date);
          await eventRepo.deleteEventsForElementOnDate(db, elementId, date);
          return events;
        });
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
