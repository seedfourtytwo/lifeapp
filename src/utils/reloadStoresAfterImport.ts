import { preloadConfiguredHabitSounds } from '../audio/preloadConfiguredHabitSounds';
import { stopHabitSound } from '../audio/habitTimerSound';
import { cancelCalendarReminders } from '../notifications/calendarReminders';
import type { ClearAppDataOptions } from '../db/clearDataPlan';
import { applyAppLanguage } from '../i18n';
import { clearCachedForecast } from '../weather/forecastCache';
import { getActiveCounters, getActiveHabits } from './dashboardElements';
import { useCalendarStore } from '../store/calendarStore';
import { useElementStore } from '../store/elementStore';
import {
  awaitHabitTimerStops,
  bumpEventDataEpoch,
  habitStreakInputsFromElements,
  useEventStore,
} from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';

export type ReloadStoresOptions = {
  /** Full replace (import) — treat calendar + weather + activity as wiped. */
  fullReplace?: boolean;
  /** Partial clear plan — only wipe mirrors that were cleared. */
  cleared?: Pick<
    ClearAppDataOptions,
    'calendar' | 'weather' | 'preferences' | 'definitions' | 'activityHistory'
  >;
};

/** Reload Zustand mirrors after SQLite data is replaced or cleared. */
export async function reloadStoresAfterImport(
  options: ReloadStoresOptions = { fullReplace: true },
): Promise<void> {
  const full = options.fullReplace === true;
  const calendarCleared = full || Boolean(options.cleared?.calendar);
  const weatherCleared =
    full || Boolean(options.cleared?.weather) || Boolean(options.cleared?.preferences);
  const activityCleared =
    full ||
    Boolean(options.cleared?.definitions) ||
    Boolean(options.cleared?.activityHistory);
  const preferencesCleared = full || Boolean(options.cleared?.preferences);

  await stopHabitSound();
  bumpEventDataEpoch();
  await awaitHabitTimerStops();

  if (activityCleared) {
    useEventStore.setState({
      activeTimerSessions: {},
      dailyTotals: {},
      habitDoneToday: {},
      habitStreaks: {},
      habitFailureStreaks: {},
      dayStateReady: false,
      counterTotalsReady: false,
    });
  }

  if (calendarCleared) {
    await cancelCalendarReminders();
    useCalendarStore.setState({
      calendars: [],
      events: [],
      reminders: [],
      clearedByKey: {},
      isLoaded: false,
    });
  }

  if (weatherCleared) {
    useWeatherStore.getState().clear();
    await clearCachedForecast();
  }

  await useElementStore.getState().load();

  if (activityCleared) {
    const { elements, dashboard } = useElementStore.getState();
    const habitInputs = habitStreakInputsFromElements(getActiveHabits(elements, dashboard));
    const counterIds = getActiveCounters(elements, dashboard).map((element) => element.id);

    const { loadHabitDayState, loadHabitStreaks, loadCounterTotals } = useEventStore.getState();
    // Always call day/counter loaders — empty inputs still mark *Ready flags true.
    await Promise.all([
      loadHabitDayState(habitInputs),
      habitInputs.length > 0 ? loadHabitStreaks(habitInputs) : Promise.resolve(),
      loadCounterTotals(counterIds),
    ]);

    void preloadConfiguredHabitSounds(getActiveHabits(elements, dashboard));
  }

  if (preferencesCleared || weatherCleared || full) {
    await useSettingsStore.getState().load();
  }

  await applyAppLanguage(useSettingsStore.getState().appLanguage);

  if (calendarCleared) {
    await useCalendarStore.getState().load();
  }

  if (weatherCleared && useSettingsStore.getState().weatherWidgetEnabled) {
    void useWeatherStore.getState().refresh({ force: true });
  }
}
