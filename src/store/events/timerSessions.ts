import { createActiveTimerSession, type ActiveTimerSession } from '../../protocol';

/**
 * Timer sessions as a pure reducer: each step takes the sessions and returns
 * the next ones, or the very same object when nothing changes, so the caller
 * knows there is nothing to tell. The brain of the fake native core
 * (`src/core/fakeLifeCore.ts`); `TimerSession.kt` follows the same cases.
 */
export type TimerSessions = Readonly<Record<string, ActiveTimerSession>>;

export type TimerSessionStep =
  | { type: 'start'; elementId: string; nowMs: number }
  | { type: 'pause'; elementId: string; nowMs: number }
  | { type: 'resume'; elementId: string; nowMs: number };

export function nextTimerSessions(
  sessions: TimerSessions,
  step: TimerSessionStep,
): TimerSessions {
  switch (step.type) {
    case 'start':
      if (sessions[step.elementId]) return sessions;
      return { ...sessions, [step.elementId]: createActiveTimerSession(new Date(step.nowMs)) };
    case 'pause': {
      const session = sessions[step.elementId];
      if (!session || session.pausedAt) return sessions;
      return {
        ...sessions,
        [step.elementId]: { ...session, pausedAt: new Date(step.nowMs).toISOString() },
      };
    }
    case 'resume': {
      const session = sessions[step.elementId];
      if (!session?.pausedAt) return sessions;
      // A clock set backwards while paused would make this negative, and a
      // negative offset fails validation.
      const pausedMs = Math.max(0, step.nowMs - new Date(session.pausedAt).getTime());
      return {
        ...sessions,
        [step.elementId]: {
          ...session,
          pausedAt: null,
          pauseOffsetMs: session.pauseOffsetMs + pausedMs,
        },
      };
    }
    default: {
      const unknown: never = step;
      throw new Error(`Unknown timer session step: ${JSON.stringify(unknown)}`);
    }
  }
}
