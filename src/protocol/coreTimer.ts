import { z } from 'zod';

/**
 * The running timer as the native core (`modules/life-core`) owns it: what
 * the app asks it to start, the state it reports back, and the record of a
 * finished session. Native and the fake behind it in Jest and on the web
 * speak exactly these shapes; Zod checks them where they cross the bridge.
 */

const Instant = z.string().datetime();
const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The goal in force when the session started (`habitTimerGoal`). */
export const CoreTimerGoalSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('seconds'), seconds: z.number().int().positive() }),
  z.object({ type: z.literal('play_once'), trackSeconds: z.number().int().positive() }),
  z.object({ type: z.literal('open') }),
]);

export type CoreTimerGoal = z.infer<typeof CoreTimerGoalSchema>;

export const TimerStartRequestSchema = z.object({
  trackerId: z.string().uuid(),
  /** The real name: the notification's private version only. */
  name: z.string(),
  /** What a locked phone may show; null shows "Timer". */
  lockScreenName: z.string().nullable(),
  iconKey: z.string().nullable(),
  goal: CoreTimerGoalSchema,
  /** A bundled track id, or null for the silent keepalive. */
  trackId: z.string().nullable(),
  /** Loop the track until the session ends, or play it once. */
  loop: z.boolean(),
  /** Seconds already logged today, so the goal alarm rings at the right moment. */
  loggedSeconds: z.number().int().nonnegative(),
});

export type TimerStartRequest = z.infer<typeof TimerStartRequestSchema>;

export const CoreTimerStateSchema = TimerStartRequestSchema.extend({
  /** Becomes the finished session's queue id, so finishing it twice logs it once. */
  sessionId: z.string().uuid(),
  startedAt: Instant,
  /** Set while paused. */
  pausedAt: Instant.nullable(),
  /** Milliseconds in pauses that have ended. */
  pausedMs: z.number().int().nonnegative(),
  /** The app day (local date) the session started on. */
  day: LocalDate,
  /** When the seconds goal was reached, once it has been. */
  goalReachedAt: Instant.nullable(),
  /** Last moment the process running the session was known to be alive. */
  heartbeatAt: Instant,
});

export type CoreTimerState = z.infer<typeof CoreTimerStateSchema>;

/**
 * A finished session, exactly as native appends it to the pending-actions
 * queue (`docs/widget-contract.md`, `timer_session`).
 */
export const TimerSessionRecordSchema = z.object({
  v: z.literal(1),
  /** The session's `sessionId`; the same id is never applied twice. */
  id: z.string().uuid(),
  /** When the session was finished. */
  at: Instant,
  /** The app day at `at`. */
  day: LocalDate,
  type: z.literal('timer_session'),
  trackerId: z.string().uuid(),
  startedAt: Instant,
  /** When active time stopped: the start of the pause it ended in, or `at`. */
  endedAt: Instant,
  /** Milliseconds paused between `startedAt` and `endedAt`. */
  pausedMs: z.number().int().nonnegative(),
  /** floor((endedAt - startedAt - pausedMs) / 1000). */
  activeSeconds: z.number().int().nonnegative(),
  goalSecondsInForce: z.number().int().positive().nullable(),
  /** A play-once track ran to its end. */
  trackCompleted: z.boolean(),
  /** Done was pressed: the day is marked done even short of the goal. */
  markComplete: z.boolean(),
});

export type TimerSessionRecord = z.infer<typeof TimerSessionRecordSchema>;

export interface FinishOptions {
  markComplete: boolean;
}
