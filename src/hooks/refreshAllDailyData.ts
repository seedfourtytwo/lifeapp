import { getActiveCounters, getActiveHabits } from '../utils/dashboardElements';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useElementStore } from '../store/elementStore';

/** Reload active habits, counters, and streaks for the current calendar day. */
export async function refreshAllDailyData(): Promise<void> {
  const loadElements = useElementStore.getState().load;
  await loadElements();

  const { elements, dashboard } = useElementStore.getState();
  const habitInputs = habitStreakInputsFromElements(getActiveHabits(elements, dashboard));
  const counterIds = getActiveCounters(elements, dashboard).map((element) => element.id);

  const { loadHabitDayState, loadHabitStreaks, loadCounterTotals } = useEventStore.getState();
  await Promise.all([
    habitInputs.length > 0 ? loadHabitDayState(habitInputs) : Promise.resolve(),
    habitInputs.length > 0 ? loadHabitStreaks(habitInputs) : Promise.resolve(),
    counterIds.length > 0 ? loadCounterTotals(counterIds) : Promise.resolve(),
  ]);
}

/** Clear in-memory day maps before reloading after the calendar day changes. */
export function resetInMemoryDailyState(): void {
  useEventStore.setState({
    dailyTotals: {},
    habitDoneToday: {},
    dayStateReady: false,
  });
}
