import { createActiveTimerSession, type ActiveTimerSession } from '../../protocol';
import { TIMER_HEARTBEAT_MS } from '../../protocol/timerSessionDays';

/**
 * The running timers as a pure reducer: each step takes the sessions and
 * returns the next ones, or the very same object when nothing changes, so
 * the caller knows there is nothing to show or save.
 */
export type TimerSessions = Readonly<Record<string, ActiveTimerSession>>;

export type TimerSessionStep =
  | { type: 'start'; elementId: string; nowMs: number }
  | { type: 'pause'; elementId: string; nowMs: number }
  | { type: 'resume'; elementId: string; nowMs: number }
  | { type: 'heartbeat'; elementId: string; nowMs: number }
  | { type: 'clearHeartbeats' }
  | { type: 'put'; elementId: string; session: ActiveTimerSession }
  | { type: 'remove'; elementId: string };

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
      // A clock set backwards while paused would make this negative, and a negative
      // offset fails validation when sessions are read back — dropping all of them.
      const pausedMs = Math.max(0, step.nowMs - new Date(session.pausedAt).getTime());
      // The heartbeat from before the pause goes: until the sound reports again,
      // a restart must not mistake the pause for the moment the process died.
      const { heartbeatAt: _beforePause, ...unpaused } = session;
      return {
        ...sessions,
        [step.elementId]: {
          ...unpaused,
          pausedAt: null,
          pauseOffsetMs: session.pauseOffsetMs + pausedMs,
        },
      };
    }
    case 'heartbeat': {
      const session = sessions[step.elementId];
      if (!session || session.pausedAt) return sessions;
      if (
        session.heartbeatAt &&
        step.nowMs - new Date(session.heartbeatAt).getTime() < TIMER_HEARTBEAT_MS
      ) {
        return sessions;
      }
      return {
        ...sessions,
        [step.elementId]: { ...session, heartbeatAt: new Date(step.nowMs).toISOString() },
      };
    }
    case 'clearHeartbeats':
      if (!Object.values(sessions).some((session) => session.heartbeatAt)) return sessions;
      return Object.fromEntries(
        Object.entries(sessions).map(([id, { heartbeatAt: _dropped, ...session }]) => [id, session]),
      );
    case 'put':
      return { ...sessions, [step.elementId]: step.session };
    case 'remove': {
      if (!(step.elementId in sessions)) return sessions;
      const { [step.elementId]: _removed, ...rest } = sessions;
      return rest;
    }
    default: {
      const unknown: never = step;
      throw new Error(`Unknown timer session step: ${JSON.stringify(unknown)}`);
    }
  }
}
