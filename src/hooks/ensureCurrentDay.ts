import { stopHabitSound } from '../audio/habitTimerSound';
import { stopHabitTimerLockScreenTicker } from '../kinds/habit/habitTimerLockScreen';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { refreshAllDailyData, resetInMemoryDailyState } from './refreshAllDailyData';

async function finalizeTimersForPreviousDay(previousDate: string): Promise<void> {
  const sessions = useEventStore.getState().activeTimerSessions;
  const ids = Object.keys(sessions);
  if (ids.length === 0) return;

  stopHabitTimerLockScreenTicker();
  await stopHabitSound();
  const elements = useElementStore.getState().elements;
  const stopHabitTimer = useEventStore.getState().stopHabitTimer;
  const discardHabitTimer = useEventStore.getState().discardHabitTimer;

  const failures: string[] = [];
  for (const elementId of ids) {
    const element = elements.find((item) => item.id === elementId);
    if (element?.kind === 'habit') {
      try {
        // Session.calendarDate is the persist day; previousDate is for logging/context.
        await stopHabitTimer(elementId, element.config, previousDate);
      } catch (error) {
        console.warn('Failed to finalize timer on day rollover', error);
        failures.push(elementId);
      }
    } else {
      discardHabitTimer(elementId);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to finalize ${failures.length} timer(s) on day rollover`);
  }
}

let rollover: Promise<void> | null = null;

/**
 * Bring today's in-memory maps up to the current calendar day if they still
 * describe an earlier one: finish yesterday's timers onto yesterday, then
 * reload. Anything that acts on "today" without the app in front — the
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
    await finalizeTimersForPreviousDay(previousDate);
    resetInMemoryDailyState();
    await refreshAllDailyData();
    useEventStore.setState({ dayMapsDate: today });
  })().finally(() => {
    rollover = null;
  });
  return rollover;
}
