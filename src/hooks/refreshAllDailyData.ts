import { getActiveCounters, getActiveHabits } from '../utils/dashboardElements';
import {
  counterStreakInputsFromElements,
  habitStreakInputsFromElements,
  useEventStore,
  type CounterStreakInput,
  type HabitStreakInput,
} from '../store/eventStore';
import { useElementStore } from '../store/elementStore';
import { getDatabase } from '../db/client';
import { readDataVersion } from '../db/dataVersion';

type DailyRefreshInputs = {
  habits: HabitStreakInput[];
  counterIds: string[];
  counterStreaks: CounterStreakInput[];
};

function deriveInputsFromStore(): DailyRefreshInputs {
  const { elements, dashboard } = useElementStore.getState();
  const counters = getActiveCounters(elements, dashboard);
  return {
    habits: habitStreakInputsFromElements(getActiveHabits(elements, dashboard)),
    counterIds: counters.map((element) => element.id),
    counterStreaks: counterStreakInputsFromElements(counters),
  };
}

/**
 * Reload elements, then derive the query inputs for everything shown on Home
 * from the *fresh* store state. Callers that only need one half still reload
 * elements first, because an archive or edit on another screen is what usually
 * triggers the refresh.
 */
async function reloadElementsAndDeriveInputs(): Promise<DailyRefreshInputs> {
  await useElementStore.getState().load();
  return deriveInputsFromStore();
}

/** Reload active habits, counters, and streaks for the current calendar day. */
export async function refreshAllDailyData(): Promise<void> {
  const { habits, counterIds, counterStreaks } = await reloadElementsAndDeriveInputs();
  const { loadHabitDayState, loadHabitStreaks, loadCounterTotals, loadCounterStreaks } =
    useEventStore.getState();

  // Day-state and totals are called even with empty inputs: after a rollover
  // `resetInMemoryDailyState` cleared the *Ready flags, and only these loaders
  // set them back to true.
  await Promise.all([
    loadHabitDayState(habits),
    loadCounterTotals(counterIds),
    habits.length > 0 ? loadHabitStreaks(habits) : Promise.resolve(),
    counterStreaks.length > 0 ? loadCounterStreaks(counterStreaks) : Promise.resolve(),
  ]);
}

/** Pull-to-refresh of habits: elements, today's habit state, and streaks. */
export async function refreshAllHabitData(): Promise<void> {
  const { habits } = await reloadElementsAndDeriveInputs();
  if (habits.length === 0) return;

  const { loadHabitDayState, loadHabitStreaks } = useEventStore.getState();
  await Promise.all([loadHabitDayState(habits), loadHabitStreaks(habits)]);
}

/** Pull-to-refresh of counters: elements, today's totals, and target streaks. */
export async function refreshAllCounterData(): Promise<void> {
  const { counterIds, counterStreaks } = await reloadElementsAndDeriveInputs();
  const { loadCounterTotals, loadCounterStreaks } = useEventStore.getState();

  await Promise.all([
    counterIds.length > 0 ? loadCounterTotals(counterIds) : Promise.resolve(),
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

/** The connection and `PRAGMA data_version` reading the last today-refresh saw. */
let lastSeenVersion: { db: object; version: number } | null = null;
let todayRefreshInFlight: Promise<void> | null = null;
let todayRefreshAgain = false;
let todayRefreshAgainForced = false;

async function refreshTodayOnce(force: boolean): Promise<void> {
  if (!useElementStore.getState().isLoaded) return; // bootstrap's first load covers it
  const db = await getDatabase();
  // Read before the loads: a write landing mid-reload moves the version again,
  // so the next call reloads rather than missing it.
  const version = await readDataVersion(db);
  const unchanged =
    version !== null && lastSeenVersion?.db === db && lastSeenVersion.version === version;
  if (unchanged && !force) return;

  const { habits, counterIds, counterStreaks } = deriveInputsFromStore();
  const {
    loadHabitDayState,
    loadHabitStreaks,
    loadCounterTotals,
    loadCounterStreaks,
    loadWidgetTimerSessions,
  } = useEventStore.getState();
  try {
    // Loaders merge in place (no blanking, so no flicker) and skip any element
    // with a write in flight, so an optimistic tick is never painted over.
    await Promise.all([
      habits.length > 0 ? loadHabitDayState(habits) : Promise.resolve(),
      habits.length > 0 ? loadHabitStreaks(habits) : Promise.resolve(),
      counterIds.length > 0 ? loadCounterTotals(counterIds) : Promise.resolve(),
      counterStreaks.length > 0 ? loadCounterStreaks(counterStreaks) : Promise.resolve(),
      // The widget starts and stops its stopwatches in the same file.
      loadWidgetTimerSessions(),
    ]);
    lastSeenVersion = version === null ? null : { db, version };
  } catch (error) {
    lastSeenVersion = null;
    throw error;
  }
}

/**
 * Re-read today's habit and counter state (totals, done flags, streaks) from
 * SQLite, for writes made outside this JS context — the Android home-screen
 * widget. The single entry point for "something else may have written":
 * AppState `active` calls it, and native code can trigger it later through an
 * event while the app is in the foreground.
 *
 * Cheap when nothing changed: a `PRAGMA data_version` that matches the last
 * refresh skips every query (`force` reloads regardless). Calls during a
 * refresh coalesce into one follow-up run. Never throws; failures are logged.
 * Does not reload element definitions — the widget writes events only.
 */
export function refreshTodayFromDb(options?: { force?: boolean }): Promise<void> {
  const force = options?.force ?? false;
  if (todayRefreshInFlight) {
    todayRefreshAgain = true;
    todayRefreshAgainForced ||= force;
    return todayRefreshInFlight;
  }
  const run = async () => {
    let forceThisRun = force;
    do {
      todayRefreshAgain = false;
      todayRefreshAgainForced = false;
      try {
        await refreshTodayOnce(forceThisRun);
      } catch (error) {
        console.warn('Refreshing today from the database failed', error);
      }
      forceThisRun = todayRefreshAgainForced;
    } while (todayRefreshAgain);
  };
  todayRefreshInFlight = run().finally(() => {
    todayRefreshInFlight = null;
  });
  return todayRefreshInFlight;
}

/** Test helper — forget the last data_version reading and any in-flight refresh. */
export function resetTodayRefreshForTests(): void {
  lastSeenVersion = null;
  todayRefreshInFlight = null;
  todayRefreshAgain = false;
  todayRefreshAgainForced = false;
}
