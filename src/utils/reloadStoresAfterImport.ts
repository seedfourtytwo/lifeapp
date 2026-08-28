import { preloadConfiguredHabitSounds } from '../audio/preloadConfiguredHabitSounds';
import { stopHabitSound } from '../audio/habitTimerSound';
import { cancelCalendarReminders } from '../notifications/calendarReminders';
import type { ClearAppDataOptions } from '../db/clearDataPlan';
import { applyAppLanguage } from '../i18n';
import { bumpDataGeneration } from '../db/dataGeneration';
import { getActiveCounters, getActiveHabits } from './dashboardElements';
import { useCalendarStore } from '../store/calendarStore';
import { useElementStore } from '../store/elementStore';
import { useFoodStore } from '../store/foodStore';
import { useTodoStore } from '../store/todoStore';
import {
  awaitHabitTimerStops,
  counterStreakInputsFromElements,
  habitStreakInputsFromElements,
  useEventStore,
} from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import { currentAppCalendarDate } from './dayRollover';

export type ReloadStoresOptions = {
  /** Full replace (import) — treat calendar + weather + activity as wiped. */
  fullReplace?: boolean;
  /** Partial clear plan — only wipe mirrors that were cleared. */
  cleared?: Pick<
    ClearAppDataOptions,
    'calendar' | 'weather' | 'preferences' | 'definitions' | 'activityHistory'
  >;
};

/**
 * Reload Zustand mirrors after SQLite data is replaced or cleared.
 *
 * Each store blanks itself through `reset()` (see `store/mirrorReset.ts`); what
 * stays here is what no single store can know: which scopes the wipe touched,
 * and the order the mirrors have to come back in.
 */
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
  bumpDataGeneration('protocol');
  if (activityCleared) {
    // The catalog, todo list and journals were wiped with activity — drop the
    // writes that were still in flight against the old rows.
    bumpDataGeneration('catalog');
    bumpDataGeneration('todos');
    bumpDataGeneration('journal');
  }
  // Only safe to blank the event mirror once no timer stop is still writing.
  await awaitHabitTimerStops();

  if (activityCleared) {
    await useEventStore.getState().reset();
  }

  if (calendarCleared) {
    // Cancel while the reminders are still in the mirror: the notification sync
    // owner schedules from that state, so it has to go second.
    await cancelCalendarReminders();
    await useCalendarStore.getState().reset();
  }

  if (weatherCleared) {
    await useWeatherStore.getState().reset();
  }

  await useElementStore.getState().load();

  if (activityCleared) {
    // The day maps are keyed by the elements that just reloaded, so their
    // refill belongs here rather than in the event store.
    const { elements, dashboard } = useElementStore.getState();
    const habitInputs = habitStreakInputsFromElements(getActiveHabits(elements, dashboard));
    const counters = getActiveCounters(elements, dashboard);
    const counterIds = counters.map((element) => element.id);
    const counterStreakInputs = counterStreakInputsFromElements(counters);

    const { loadHabitDayState, loadHabitStreaks, loadCounterTotals, loadCounterStreaks } =
      useEventStore.getState();
    // Always call day/counter loaders — empty inputs still mark *Ready flags true.
    await Promise.all([
      loadHabitDayState(habitInputs),
      habitInputs.length > 0 ? loadHabitStreaks(habitInputs) : Promise.resolve(),
      loadCounterTotals(counterIds),
      counterStreakInputs.length > 0
        ? loadCounterStreaks(counterStreakInputs)
        : Promise.resolve(),
    ]);

    void preloadConfiguredHabitSounds(getActiveHabits(elements, dashboard));

    await useFoodStore.getState().reset();
    await useFoodStore.getState().loadWeek(currentAppCalendarDate());

    // Open todos survive a definitions-only clear, so refetch rather than blank.
    await useTodoStore.getState().reload();
  }

  if (preferencesCleared || weatherCleared || full) {
    await useSettingsStore.getState().load();
  }

  // Needs the language setting that load() just read back.
  await applyAppLanguage(useSettingsStore.getState().appLanguage);

  if (calendarCleared) {
    await useCalendarStore.getState().load();
  }

  if (weatherCleared && useSettingsStore.getState().weatherWidgetEnabled) {
    void useWeatherStore.getState().refresh({ force: true });
  }
}
