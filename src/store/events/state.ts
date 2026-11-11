import type { ActiveTimerSession, HabitConfig, LifeEvent } from '../../protocol';
import { currentAppCalendarDate } from '../../utils/dayRollover';
import type { CounterStreakInput } from '../counterStreakFetch';
import type { HabitStreakInput } from '../habitStreakFetch';
import type { ResettableMirror } from '../mirrorReset';

/**
 * A tap made somewhere else (the widget) and applied later: it keeps its own
 * id, so applying it twice inserts once, and the moment and day it happened.
 */
export interface LoggedElsewhere {
  id: string;
  timestamp: string;
  date: string;
}

export interface HabitTimerStopOptions {
  trackCompleted?: boolean;
  playChime?: boolean;
  /** Done pressed before the goal: the stop also marks the day done. */
  markComplete?: boolean;
}

/** The event store's shape: today's mirror of SQLite, the timer sessions, and the commands. */
export interface EventState extends ResettableMirror {
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
    logged?: LoggedElsewhere,
  ) => Promise<string | null>;
  /** Undo for counter taps: deletes exactly the events `logEvent` returned. */
  deleteCounterEvents: (elementId: string, eventIds: readonly string[]) => Promise<void>;
  setDailyTotal: (elementId: string, total: number, date?: string) => Promise<void>;
  toggleHabit: (elementId: string, config: HabitConfig, date?: string) => Promise<void>;
  /** Tick the day (today by default) unless SQLite says it is already done — never un-ticks. */
  completeHabit: (elementId: string, config: HabitConfig, date?: string) => Promise<void>;
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

export type SetEventState = (partial: Partial<EventState>) => void;
export type GetEventState = () => EventState;

export function todayDate(): string {
  return currentAppCalendarDate();
}
