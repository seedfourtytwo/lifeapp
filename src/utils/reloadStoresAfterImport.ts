import { preloadConfiguredHabitSounds } from '../audio/preloadConfiguredHabitSounds';
import { getPinnedElements, getPinnedHabits } from './dashboardElements';
import { useElementStore } from '../store/elementStore';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';

/** Reload Zustand mirrors after SQLite data is replaced or cleared. */
export async function reloadStoresAfterImport(): Promise<void> {
  useEventStore.setState({
    activeTimerSessions: {},
    dailyTotals: {},
    habitDoneToday: {},
    habitStreaks: {},
    habitFailureStreaks: {},
  });

  await useElementStore.getState().load();
  const { elements, dashboard } = useElementStore.getState();
  const habitInputs = habitStreakInputsFromElements(getPinnedHabits(elements, dashboard));
  const counterIds = getPinnedElements(
    elements.filter((element) => element.kind === 'counter'),
    dashboard,
  ).map((element) => element.id);

  const { loadHabitDayState, loadHabitStreaks, loadCounterTotals } = useEventStore.getState();
  await Promise.all([
    habitInputs.length > 0 ? loadHabitDayState(habitInputs) : Promise.resolve(),
    habitInputs.length > 0 ? loadHabitStreaks(habitInputs) : Promise.resolve(),
    counterIds.length > 0 ? loadCounterTotals(counterIds) : Promise.resolve(),
  ]);

  void preloadConfiguredHabitSounds(getPinnedHabits(elements, dashboard));
  await useSettingsStore.getState().load();
}
