import { isHabitElement, type ActiveTimerSession } from '../../protocol';
import type { CoreTimerState } from '../../protocol/coreTimer';
import { timerSessionFromMidnight } from '../../protocol/timerSessionDays';
import { lifeCore } from '../../core/lifeCore';
import { getDatabase } from '../../db/client';
import * as elementRepo from '../../db/repositories/elementRepository';
import { armTargetCrossing, disarmTargetCrossing } from './dayMirror';
import { todayDate, type EventState, type GetEventState, type SetEventState } from './state';

type TimerSessionActions = Pick<
  EventState,
  | 'syncTimerFromCore'
  | 'reloadActiveTimerSessions'
  | 'startHabitTimer'
  | 'pauseHabitTimer'
  | 'resumeHabitTimer'
  | 'finishHabitTimer'
  | 'discardHabitTimer'
>;

/**
 * The core's session as the screens show it. One started on an earlier day
 * shows from local midnight on, so today's card counts today's seconds.
 */
function sessionsFromCore(
  state: CoreTimerState | null,
  nowMs: number,
): Record<string, ActiveTimerSession> {
  if (!state) return {};
  const session: ActiveTimerSession = {
    startedAt: state.startedAt,
    pausedAt: state.pausedAt,
    pauseOffsetMs: state.pausedMs,
    calendarDate: state.day,
  };
  return {
    [state.trackerId]:
      state.day < todayDate() ? timerSessionFromMidnight(session, nowMs) : session,
  };
}

/** The timer in the store is a mirror of the native core's; these are calls into it. */
export function createTimerSessionActions(
  set: SetEventState,
  get: GetEventState,
): TimerSessionActions {
  /** Mirror updates land in the order they were asked for, so an older state never wins. */
  let syncs: Promise<void> = Promise.resolve();
  const inOrder = (work: () => Promise<void>): Promise<void> => {
    const next = syncs.catch(() => undefined).then(work);
    syncs = next.catch(() => undefined);
    return next;
  };

  const mirror = async (state: CoreTimerState | null): Promise<void> => {
    const current = get().activeTimerSessions;
    const next = sessionsFromCore(state, Date.now());
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    for (const id of Object.keys(current)) disarmTargetCrossing(id);
    set({ activeTimerSessions: next });
    if (!state) return;
    const element = await elementRepo.getElementById(await getDatabase(), state.trackerId);
    if (element && isHabitElement(element)) armTargetCrossing(element.id, element.config, set, get);
  };

  const sync = (state: CoreTimerState | null) => inOrder(() => mirror(state));

  return {
    syncTimerFromCore: sync,

    reloadActiveTimerSessions: () => inOrder(async () => mirror(await lifeCore.getState())),

    startHabitTimer: async (request) => sync(await lifeCore.start(request)),

    pauseHabitTimer: async () => sync(await lifeCore.pause()),

    resumeHabitTimer: async () => sync(await lifeCore.resume()),

    finishHabitTimer: async (markComplete) => {
      const record = await lifeCore.finish({ markComplete });
      await sync(null);
      return record;
    },

    discardHabitTimer: async (elementId) => {
      const state = await lifeCore.getState();
      if (!state || (elementId !== undefined && state.trackerId !== elementId)) return;
      await lifeCore.discard();
      await sync(null);
    },
  };
}
