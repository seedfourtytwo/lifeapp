import { finishTimerPausedBeforeToday } from '../habitTimer/habitTimerControls';
import { useEventStore } from '../store/eventStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { refreshAllDailyData, resetInMemoryDailyState } from './refreshAllDailyData';

let rollover: Promise<void> | null = null;

/**
 * Bring today's in-memory maps up to the current calendar day if they still
 * describe an earlier one, then reload. A timer paused before midnight is
 * finished, its seconds going to the days they happened on; a running one
 * runs on, shown from midnight, and is split when it ends. One rollover at a
 * time; callers join it. Rejects if the rollover failed, leaving the maps'
 * date unchanged so the next call retries.
 */
export function ensureCurrentDay(): Promise<void> {
  if (rollover) return rollover;
  const previousDate = useEventStore.getState().dayMapsDate;
  const today = currentAppCalendarDate();
  if (previousDate === today) return Promise.resolve();

  rollover = (async () => {
    await finishTimerPausedBeforeToday();
    resetInMemoryDailyState();
    await refreshAllDailyData();
    await useEventStore.getState().reloadActiveTimerSessions();
    useEventStore.setState({ dayMapsDate: today });
  })().finally(() => {
    rollover = null;
  });
  return rollover;
}
