import { z } from 'zod';
import { toDateString } from './event';

export const ActiveTimerSessionSchema = z.object({
  startedAt: z.string().datetime(),
  pausedAt: z.string().datetime().nullable().default(null),
  pauseOffsetMs: z.number().int().nonnegative().default(0),
  /** Local calendar day the session belongs to (captured at start for midnight-safe finalize). */
  calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ActiveTimerSession = z.infer<typeof ActiveTimerSessionSchema>;

/**
 * A stopwatch the Android widget is running on a habit. The widget owns these
 * (it starts, stops and logs them); the app only reads them, to refuse starting
 * a second timer on the same habit.
 */
export const WidgetTimerSessionSchema = z.object({
  startedAt: z.string().datetime(),
  calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type WidgetTimerSession = z.infer<typeof WidgetTimerSessionSchema>;

export function createActiveTimerSession(now = new Date()): ActiveTimerSession {
  return {
    startedAt: now.toISOString(),
    pausedAt: null,
    pauseOffsetMs: 0,
    calendarDate: toDateString(now),
  };
}

export function isActiveTimerPaused(session: ActiveTimerSession | null | undefined): boolean {
  return Boolean(session?.pausedAt);
}

/** Elapsed active time in ms, excluding paused intervals. */
export function activeTimerElapsedMs(
  session: ActiveTimerSession,
  nowMs = Date.now(),
): number {
  const startedMs = new Date(session.startedAt).getTime();
  let pausedMs = session.pauseOffsetMs;
  if (session.pausedAt) {
    pausedMs += nowMs - new Date(session.pausedAt).getTime();
  }
  return Math.max(0, nowMs - startedMs - pausedMs);
}

export function activeTimerElapsedSeconds(
  session: ActiveTimerSession,
  nowMs = Date.now(),
): number {
  return Math.floor(activeTimerElapsedMs(session, nowMs) / 1000);
}
