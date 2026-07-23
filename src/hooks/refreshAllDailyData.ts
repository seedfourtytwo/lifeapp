import { getActiveCounters, getActiveHabits } from '../utils/dashboardElements';
import {
  counterStreakInputsFromElements,
  habitStreakInputsFromElements,
  useEventStore,
} from '../store/eventStore';
import { useElementStore } from '../store/elementStore';

/** Reload active habits, counters, and streaks for the current calendar day. */
export async function refreshAllDailyData(): Promise<void> {
  const loadElements = useElementStore.getState().load;
  await loadElements();

  const { elements, dashboard } = useElementStore.getState();
  const habitInputs = habitStreakInputsFromElements(getActiveHabits(elements, dashboard));
  const counters = getActiveCounters(elements, dashboard);
  const counterIds = counters.map((element) => element.id);
  const counterStreakInputs = counterStreakInputsFromElements(counters);

  const { loadHabitDayState, loadHabitStreaks, loadCounterTotals, loadCounterStreaks } =
    useEventStore.getState();
  // Always call loaders — empty inputs still mark *Ready flags true.
  await Promise.all([
    loadHabitDayState(habitInputs),
    habitInputs.length > 0 ? loadHabitStreaks(habitInputs) : Promise.resolve(),
    loadCounterTotals(counterIds),
    counterStreakInputs.length > 0
      ? loadCounterStreaks(counterStreakInputs)
      : Promise.resolve(),
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
