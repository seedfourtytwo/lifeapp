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
  // Always call loaders — empty inputs still mark *Ready flags true.
  await Promise.all([
    loadHabitDayState(habitInputs),
    habitInputs.length > 0 ? loadHabitStreaks(habitInputs) : Promise.resolve(),
    loadCounterTotals(counterIds),
  ]);
}

/** Clear in-memory day maps before reloading after the calendar day changes. */
export function resetInMemoryDailyState(): void {
  useEventStore.setState({
    dailyTotals: {},
    habitDoneToday: {},
    dayStateReady: false,
    counterTotalsReady: false,
  });
}
