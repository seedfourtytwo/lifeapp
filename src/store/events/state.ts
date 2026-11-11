import type { ActiveTimerSession, HabitConfig, LifeEvent } from '../../protocol';
import type {
  CoreTimerState,
  TimerSessionRecord,
  TimerStartRequest,
} from '../../protocol/coreTimer';
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
  /**
   * The native core's one session, mirrored: keyed by its tracker, shown from
   * local midnight on when it started on an earlier day (its seconds before
   * midnight go to that day when it ends).
   */
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
  /** Mirror this state of the native core; calls apply in the order they were made. */
  syncTimerFromCore: (state: CoreTimerState | null) => Promise<void>;
  /** Ask the native core for its session and mirror it. */
  reloadActiveTimerSessions: () => Promise<void>;
  /** Start (or resume this tracker's paused) session in the native core. */
  startHabitTimer: (request: TimerStartRequest) => Promise<void>;
  pauseHabitTimer: () => Promise<void>;
  resumeHabitTimer: () => Promise<void>;
  /**
   * End the native session and hand back its record, for the caller to log
   * (`applyFinishedTimerSession`); null when there was none.
   */
  finishHabitTimer: (markComplete: boolean) => Promise<TimerSessionRecord | null>;
  /** Throw away this tracker's session (archive, delete), or any session (clear data). */
  discardHabitTimer: (elementId?: string) => Promise<void>;
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
  /**
   * Log a session the native core finished: each day it ran on gets its own
   * seconds with the goal that was in force, and Done marks the day it ended
   * on unless the session already made it done. Its rows take ids derived
   * from the record's id, so applying the same record again inserts nothing.
   */
  applyTimerSession: (
    elementId: string,
    config: HabitConfig,
    record: TimerSessionRecord,
  ) => Promise<void>;
  /**
   * Done on a timed habit with no session: marks today done unless it is.
   * Resolves true when the day is now done only because of that mark, so
   * Undo is worth offering. A running session ends through the core instead.
   */
  markHabitDone: (elementId: string, config: HabitConfig) => Promise<boolean>;
  /** The day is done, and only because Done was pressed: Undo has something to take back. */
  isHabitDayDoneOnlyByMark: (elementId: string, config: HabitConfig, date: string) => Promise<boolean>;
  /** Undo for `markHabitDone`: removes today's mark, keeps every logged second. */
  unmarkHabitDone: (elementId: string, config: HabitConfig) => Promise<void>;
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
