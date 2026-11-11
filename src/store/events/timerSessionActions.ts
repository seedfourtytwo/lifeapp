import { isHabitElement, type ActiveTimerSession } from '../../protocol';
import { getDatabase } from '../../db/client';
import * as elementRepo from '../../db/repositories/elementRepository';
import { loadPersistedActiveTimerSessions } from '../../db/repositories/activeTimerRepository';
import { pauseAtLastHeartbeat } from '../../protocol/timerSessionDays';
import { armTargetCrossing, disarmTargetCrossing } from './dayMirror';
import { isAnyHabitTimerStopping } from './eventCommands';
import {
  isActiveTimersReady,
  loadSavedSessionsUnlessOvertaken,
  schedulePersistActiveTimers,
} from './timerPersistence';
import { nextTimerSessions, type TimerSessionStep } from './timerSessions';
import { todayDate, type EventState, type GetEventState, type SetEventState } from './state';

type TimerSessionActions = Pick<
  EventState,
  | 'hydrateActiveTimerSessions'
  | 'reloadActiveTimerSessions'
  | 'recordTimerHeartbeat'
  | 'clearTimerHeartbeats'
  | 'startHabitTimer'
  | 'pauseHabitTimer'
  | 'resumeHabitTimer'
  | 'discardHabitTimer'
>;

/** The persistence shell around the timer reducer: show the next sessions, then save them. */
export function createTimerSessionActions(
  set: SetEventState,
  get: GetEventState,
): TimerSessionActions {
  const step = (change: TimerSessionStep): boolean => {
    const current = get().activeTimerSessions;
    const next = nextTimerSessions(current, change);
    if (next === current) return false;
    set({ activeTimerSessions: next });
    schedulePersistActiveTimers(next);
    return true;
  };

  return {
    hydrateActiveTimerSessions: async () => {
      const db = await getDatabase();
      const sessions = await loadPersistedActiveTimerSessions(db);
      if (Object.keys(sessions).length === 0) return;
      // Do not clobber a timer started before hydration finished.
      if (Object.keys(get().activeTimerSessions).length > 0) return;

      const elements = await elementRepo.getAllElements(db);
      const habitsById = new Map(elements.filter(isHabitElement).map((el) => [el.id, el]));
      const today = todayDate();
      const nowMs = Date.now();
      const kept: Record<string, ActiveTimerSession> = {};

      for (const [id, saved] of Object.entries(sessions)) {
        // The process that ran it is gone: nothing after its last heartbeat counts.
        const session = pauseAtLastHeartbeat(saved, nowMs);
        const element = habitsById.get(id);
        if (!element) {
          // Habit gone — drop orphaned persistence without inventing an event.
          console.warn('Dropping persisted timer for missing habit', id);
          continue;
        }

        if (session.calendarDate !== today) {
          // Cold start after midnight — finalize, each day getting its own seconds.
          set({
            activeTimerSessions: nextTimerSessions(get().activeTimerSessions, {
              type: 'put',
              elementId: id,
              session,
            }),
          });
          try {
            await get().stopHabitTimer(id, element.config);
          } catch (error) {
            console.warn('Failed to finalize stale timer on hydrate', error);
            get().discardHabitTimer(id);
          }
          continue;
        }

        kept[id] = session;
      }

      // Keep at most one session (matches runtime single-timer rule).
      // Finalize extras so their elapsed time is logged instead of dropped.
      const keptIds = Object.keys(kept);
      for (const id of keptIds.slice(1)) {
        const element = habitsById.get(id);
        if (!element) continue;
        set({
          activeTimerSessions: nextTimerSessions(get().activeTimerSessions, {
            type: 'put',
            elementId: id,
            session: kept[id],
          }),
        });
        try {
          await get().stopHabitTimer(id, element.config);
        } catch (error) {
          console.warn('Failed to finalize extra timer on hydrate', error);
          get().discardHabitTimer(id);
        }
        delete kept[id];
      }

      const firstId = Object.keys(kept)[0];
      // User may have started a timer while we finalized persisted rows — never clobber.
      if (Object.keys(get().activeTimerSessions).length > 0) {
        schedulePersistActiveTimers(get().activeTimerSessions);
        return;
      }
      const activeTimerSessions = firstId ? { [firstId]: kept[firstId] } : {};
      set({ activeTimerSessions });
      schedulePersistActiveTimers(activeTimerSessions);
      const firstHabit = firstId ? habitsById.get(firstId) : undefined;
      if (firstHabit) armTargetCrossing(firstHabit.id, firstHabit.config, set, get);
    },

    reloadActiveTimerSessions: async () => {
      // Before the cold-start hydrate, saved sessions may be from a dead process.
      if (!isActiveTimersReady()) return;
      const saved = await loadSavedSessionsUnlessOvertaken();
      if (!saved || isAnyHabitTimerStopping()) return;
      const current = get().activeTimerSessions;
      if (JSON.stringify(saved) === JSON.stringify(current)) return;

      for (const id of Object.keys(current)) {
        if (!saved[id]) disarmTargetCrossing(id);
      }
      set({ activeTimerSessions: saved });
      const elements = await elementRepo.getAllElements(await getDatabase());
      for (const element of elements.filter(isHabitElement)) {
        if (saved[element.id]) armTargetCrossing(element.id, element.config, set, get);
      }
    },

    recordTimerHeartbeat: (elementId) => {
      step({ type: 'heartbeat', elementId, nowMs: Date.now() });
    },

    clearTimerHeartbeats: () => {
      step({ type: 'clearHeartbeats' });
    },

    startHabitTimer: (elementId, config) => {
      if (step({ type: 'start', elementId, nowMs: Date.now() })) {
        armTargetCrossing(elementId, config, set, get);
      }
    },

    pauseHabitTimer: (elementId) => {
      const session = get().activeTimerSessions[elementId];
      if (!session || session.pausedAt) return;
      disarmTargetCrossing(elementId);
      step({ type: 'pause', elementId, nowMs: Date.now() });
    },

    resumeHabitTimer: (elementId, config) => {
      if (step({ type: 'resume', elementId, nowMs: Date.now() })) {
        armTargetCrossing(elementId, config, set, get);
      }
    },

    discardHabitTimer: (elementId) => {
      disarmTargetCrossing(elementId);
      const next = nextTimerSessions(get().activeTimerSessions, { type: 'remove', elementId });
      set({ activeTimerSessions: next });
      schedulePersistActiveTimers(next);
    },
  };
}
