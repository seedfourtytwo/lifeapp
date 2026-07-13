import { z } from 'zod';

export const ActiveTimerSessionSchema = z.object({
  startedAt: z.string().datetime(),
  pausedAt: z.string().datetime().nullable().default(null),
  pauseOffsetMs: z.number().int().nonnegative().default(0),
});

export type ActiveTimerSession = z.infer<typeof ActiveTimerSessionSchema>;

export function createActiveTimerSession(now = new Date()): ActiveTimerSession {
  return {
    startedAt: now.toISOString(),
    pausedAt: null,
    pauseOffsetMs: 0,
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
