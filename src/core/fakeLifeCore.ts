import { activeTimerElapsedMs } from '../protocol/activeTimerSession';
import { toDateString } from '../protocol/event';
import type {
  CoreTimerState,
  TimerSessionRecord,
  TimerStartRequest,
} from '../protocol/coreTimer';
import { nextTimerSessions, type TimerSessions, type TimerSessionStep } from '../store/events/timerSessions';
import { newId } from '../utils/id';
import type { LifeCore } from './lifeCoreTypes';

/**
 * The native core's behaviour without Android: the stage 5 timer reducer
 * keeps the session, and finishing hands back the record native would queue.
 * Used on the web and in Jest. There is no sound, no notification and no
 * goal alarm (the voice note "plays" until stopped), so `goalReachedAt` stays null, and a reload of the page loses
 * the session.
 */
export function createFakeLifeCore(now: () => number = Date.now): LifeCore {
  let request: TimerStartRequest | null = null;
  let sessionId = '';
  let sessions: TimerSessions = {};
  let heartbeatAt = '';
  const listeners = new Set<(state: CoreTimerState | null) => void>();
  const noteListeners = new Set<(playing: boolean) => void>();
  let notePlaying = false;

  /** The note plays until stopped: the fake has no file and no end. */
  const setNotePlaying = (playing: boolean) => {
    if (playing === notePlaying) return;
    notePlaying = playing;
    for (const listener of noteListeners) listener(playing);
  };

  const current = (): CoreTimerState | null => {
    const session = request ? sessions[request.trackerId] : undefined;
    if (!request || !session) return null;
    return {
      ...request,
      sessionId,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      pausedMs: session.pauseOffsetMs,
      day: session.calendarDate,
      goalReachedAt: null,
      heartbeatAt,
    };
  };

  const tell = () => {
    const state = current();
    for (const listener of listeners) listener(state);
  };

  /** One reducer step on the running tracker; listeners hear of real changes only. */
  const step = (change: (trackerId: string, nowMs: number) => TimerSessionStep) => {
    if (!request) return null;
    const nowMs = now();
    const next = nextTimerSessions(sessions, change(request.trackerId, nowMs));
    if (next !== sessions) {
      sessions = next;
      heartbeatAt = new Date(nowMs).toISOString();
      tell();
    }
    return current();
  };

  const end = () => {
    request = null;
    sessions = {};
    tell();
  };

  return {
    start: async (next) => {
      const running = current();
      if (running && running.trackerId !== next.trackerId) {
        throw new Error(`A timer is already running for ${running.trackerId}`);
      }
      if (running) return step((elementId, nowMs) => ({ type: 'resume', elementId, nowMs }))!;
      request = next;
      sessionId = newId();
      return step((elementId, nowMs) => ({ type: 'start', elementId, nowMs }))!;
    },

    pause: async () => step((elementId, nowMs) => ({ type: 'pause', elementId, nowMs })),

    resume: async () => step((elementId, nowMs) => ({ type: 'resume', elementId, nowMs })),

    finish: async ({ markComplete }) => {
      const state = current();
      const session = request ? sessions[request.trackerId] : undefined;
      if (!state || !session) return null;
      const atMs = now();
      const endedAtMs = session.pausedAt ? new Date(session.pausedAt).getTime() : atMs;
      const record: TimerSessionRecord = {
        v: 1,
        id: state.sessionId,
        at: new Date(atMs).toISOString(),
        day: toDateString(new Date(atMs)),
        type: 'timer_session',
        trackerId: state.trackerId,
        startedAt: state.startedAt,
        endedAt: new Date(endedAtMs).toISOString(),
        pausedMs: state.pausedMs,
        activeSeconds: Math.floor(activeTimerElapsedMs(session, endedAtMs) / 1000),
        goalSecondsInForce: state.goal.type === 'seconds' ? state.goal.seconds : null,
        trackCompleted: false,
        markComplete,
      };
      end();
      return record;
    },

    discard: async () => {
      if (current()) end();
    },

    getState: async () => current(),

    addStateListener: (listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },

    // No widget or native scheduler off Android: nobody to tell of a file, and nothing is ever queued.
    snapshotWritten: async () => undefined,
    remindersChanged: async () => undefined,
    addQueueListener: () => ({ remove: () => undefined }),

    playNote: async () => {
      setNotePlaying(true);
      return true;
    },

    stopNote: async () => setNotePlaying(false),

    addNoteListener: (listener) => {
      noteListeners.add(listener);
      return { remove: () => noteListeners.delete(listener) };
    },

    previewSound: async () => false,

    stopPreview: async () => undefined,

    // The fake plays no preview, so none ever ends.
    addPreviewEndListener: () => ({ remove: () => undefined }),
  };
}
