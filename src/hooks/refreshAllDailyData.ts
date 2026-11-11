import { getActiveCommitment, getActiveCounters, getActiveHabits } from '../utils/dashboardElements';
import {
  counterStreakInputsFromElements,
  habitStreakInputsFromElements,
  useEventStore,
  type CounterStreakInput,
  type HabitStreakInput,
} from '../store/eventStore';
import { useElementStore } from '../store/elementStore';

type DailyRefreshInputs = {
  habits: HabitStreakInput[];
  counterIds: string[];
  /** The commitment's day is its slips, a total like a counter's. */
  commitmentIds: string[];
  counterStreaks: CounterStreakInput[];
};

/**
 * Reload elements, then derive the query inputs for everything shown on Home
 * from the *fresh* store state. Callers that only need one half still reload
 * elements first, because an archive or edit on another screen is what usually
 * triggers the refresh.
 */
async function reloadElementsAndDeriveInputs(): Promise<DailyRefreshInputs> {
  await useElementStore.getState().load();

  const { elements, dashboard } = useElementStore.getState();
  const counters = getActiveCounters(elements, dashboard);
  return {
    habits: habitStreakInputsFromElements(getActiveHabits(elements, dashboard)),
    counterIds: counters.map((element) => element.id),
    commitmentIds: [getActiveCommitment(elements)].flatMap((commitment) =>
      commitment ? [commitment.id] : [],
    ),
    counterStreaks: counterStreakInputsFromElements(counters),
  };
}

/** Reload active habits, counters, and streaks for the current calendar day. */
export async function refreshAllDailyData(): Promise<void> {
  const { habits, counterIds, commitmentIds, counterStreaks } =
    await reloadElementsAndDeriveInputs();
  const { loadHabitDayState, loadHabitStreaks, loadDayTotals, loadCounterStreaks } =
    useEventStore.getState();

  // Day-state and totals are called even with empty inputs: after a rollover
  // `resetInMemoryDailyState` cleared the *Ready flags, and only these loaders
  // set them back to true.
  await Promise.all([
    loadHabitDayState(habits),
    loadDayTotals([...counterIds, ...commitmentIds]),
    habits.length > 0 ? loadHabitStreaks(habits) : Promise.resolve(),
    counterStreaks.length > 0 ? loadCounterStreaks(counterStreaks) : Promise.resolve(),
  ]);
}

/** Pull-to-refresh on the Habits tab: elements, today's habit and commitment state, and streaks. */
export async function refreshAllHabitData(): Promise<void> {
  const { habits, commitmentIds } = await reloadElementsAndDeriveInputs();
  const { loadHabitDayState, loadHabitStreaks, loadDayTotals } = useEventStore.getState();
  await Promise.all([
    habits.length > 0 ? loadHabitDayState(habits) : Promise.resolve(),
    habits.length > 0 ? loadHabitStreaks(habits) : Promise.resolve(),
    commitmentIds.length > 0 ? loadDayTotals(commitmentIds) : Promise.resolve(),
  ]);
}

/** Pull-to-refresh on the Counters tab: elements, today's totals, and target streaks. */
export async function refreshAllCounterData(): Promise<void> {
  const { counterIds, counterStreaks } = await reloadElementsAndDeriveInputs();
  const { loadDayTotals, loadCounterStreaks } = useEventStore.getState();

  await Promise.all([
    counterIds.length > 0 ? loadDayTotals(counterIds) : Promise.resolve(),
    counterStreaks.length > 0 ? loadCounterStreaks(counterStreaks) : Promise.resolve(),
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
