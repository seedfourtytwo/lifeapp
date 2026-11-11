import { stopHabitSound } from '../audio/habitTimerSound';
import { stopHabitTimerLockScreenTicker } from '../kinds/habit/habitTimerLockScreen';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { refreshAllDailyData, resetInMemoryDailyState } from './refreshAllDailyData';

/**
 * Sessions still running from an earlier day log their seconds up to midnight
 * and keep running for today; one paused before midnight is finished.
 * Sessions started today are left alone, even when the maps still describe
 * yesterday because nothing noticed midnight yet.
 */
async function rollTimersOver(): Promise<void> {
  const sessions = useEventStore.getState().activeTimerSessions;
  const ids = Object.keys(sessions);
  if (ids.length === 0) return;

  const elements = useElementStore.getState().elements;
  const { rollHabitTimerOver, discardHabitTimer } = useEventStore.getState();

  const failures: string[] = [];
  for (const elementId of ids) {
    const element = elements.find((item) => item.id === elementId);
    if (element?.kind === 'habit') {
      try {
        await rollHabitTimerOver(elementId, element.config);
      } catch (error) {
        console.warn('Failed to roll a timer over on day rollover', error);
        failures.push(elementId);
      }
    } else {
      discardHabitTimer(elementId);
    }
  }

  // A session paused before midnight was finished: its media controls go with it.
  if (Object.keys(useEventStore.getState().activeTimerSessions).length === 0) {
    stopHabitTimerLockScreenTicker();
    await stopHabitSound();
  }

  if (failures.length > 0) {
    throw new Error(`Failed to roll ${failures.length} timer(s) over on day rollover`);
  }
}

let rollover: Promise<void> | null = null;

/**
 * Bring today's in-memory maps up to the current calendar day if they still
 * describe an earlier one: log running timers' seconds onto the days they
 * happened, then reload. Anything that acts on "today" without the app in front — the
 * lock-screen buttons — awaits this first, because a locked phone may have
 * slept through the midnight refresh. One rollover at a time; callers join it.
 * Rejects if the rollover failed, leaving the maps' date unchanged so the next
 * call retries.
 */
export function ensureCurrentDay(): Promise<void> {
  if (rollover) return rollover;
  const previousDate = useEventStore.getState().dayMapsDate;
  const today = currentAppCalendarDate();
  if (previousDate === today) return Promise.resolve();

  rollover = (async () => {
    await rollTimersOver();
    resetInMemoryDailyState();
    await refreshAllDailyData();
    useEventStore.setState({ dayMapsDate: today });
  })().finally(() => {
    rollover = null;
  });
  return rollover;
}
