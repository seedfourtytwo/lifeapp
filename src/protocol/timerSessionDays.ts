import { activeTimerElapsedMs, type ActiveTimerSession } from './activeTimerSession';
import { toDateString } from './event';

/**
 * Where a timer session's seconds go.
 *
 * A session running past midnight is split: each day gets the seconds that
 * happened on it. Only the total of past pauses is stored, not when they
 * fell, so the active time is taken as one stretch ending at the session's
 * end — every pause counted first. That is exact unless a pause came after
 * midnight before the app noticed the new day.
 */

/** How often a running session records that the process is still alive. */
export const TIMER_HEARTBEAT_MS = 30_000;
/** A heartbeat older than this at a cold start means the process died mid-session. */
export const TIMER_HEARTBEAT_STALE_MS = 2 * TIMER_HEARTBEAT_MS;

export interface TimerSessionPart {
  /** Local calendar day these seconds belong to. */
  date: string;
  startMs: number;
  endMs: number;
  seconds: number;
}

function startOfLocalDay(ms: number): number {
  const day = new Date(ms);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

function nextLocalMidnight(ms: number): number {
  const day = new Date(ms);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
}

/** When active time stopped accruing: the pause, or now. */
function activeEndMs(session: ActiveTimerSession, nowMs: number): number {
  return session.pausedAt ? new Date(session.pausedAt).getTime() : nowMs;
}

/**
 * The process died with this session running and nothing has counted since
 * its last heartbeat: treat it as paused there, so the dead hours are not
 * counted and the user can resume or finish it.
 */
export function pauseAtLastHeartbeat(
  session: ActiveTimerSession,
  nowMs: number,
): ActiveTimerSession {
  if (session.pausedAt || !session.heartbeatAt) return session;
  if (nowMs - new Date(session.heartbeatAt).getTime() <= TIMER_HEARTBEAT_STALE_MS) return session;
  return { ...session, pausedAt: session.heartbeatAt };
}

/**
 * The session's seconds by local day, oldest first. Whole seconds are cut from
 * the running total, so the parts add up to exactly the session's seconds. A
 * session too short to reach one second logs one, on the day it started.
 */
export function timerSessionParts(
  session: ActiveTimerSession,
  nowMs: number,
): TimerSessionPart[] {
  const endMs = activeEndMs(session, nowMs);
  const activeMs = activeTimerElapsedMs(session, endMs);
  const startMs = endMs - activeMs;

  const parts: TimerSessionPart[] = [];
  for (let from = startMs; from < endMs; ) {
    const to = Math.min(endMs, nextLocalMidnight(from));
    const seconds = Math.floor((to - startMs) / 1000) - Math.floor((from - startMs) / 1000);
    if (seconds > 0) parts.push({ date: toDateString(new Date(from)), startMs: from, endMs: to, seconds });
    from = to;
  }
  if (parts.length === 0) {
    return [{ date: session.calendarDate, startMs, endMs, seconds: 1 }];
  }
  return parts;
}

/**
 * The same session from today's local midnight on: what keeps running after
 * the parts before midnight have been logged.
 */
export function timerSessionFromMidnight(
  session: ActiveTimerSession,
  nowMs: number,
): ActiveTimerSession {
  const midnightMs = startOfLocalDay(nowMs);
  const endMs = activeEndMs(session, nowMs);
  const activeMs = activeTimerElapsedMs(session, endMs);
  const todayActiveMs = Math.min(activeMs, Math.max(0, endMs - midnightMs));
  const pausedAtMs = session.pausedAt ? Math.max(endMs, midnightMs) : null;
  return {
    ...session,
    startedAt: new Date(midnightMs).toISOString(),
    pausedAt: pausedAtMs === null ? null : new Date(pausedAtMs).toISOString(),
    pauseOffsetMs: Math.max(0, endMs - midnightMs - todayActiveMs),
    calendarDate: toDateString(new Date(midnightMs)),
  };
}
