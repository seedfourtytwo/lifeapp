import { useEffect } from 'react';
import {
  cancelAllHabitReminders,
  isNotificationsNativeAvailable,
  scheduleEndOfDayReminder,
  syncHabitReminders,
} from '../notifications/habitReminders';
import { countUnfinishedTrackersToday } from '../notifications/unfinishedTrackers';
import { useElementStore } from '../store/elementStore';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getActiveCounters, getActiveHabits } from '../utils/dashboardElements';

export function useHabitReminderSync(): void {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const elementsLoaded = useElementStore((s) => s.isLoaded);
  const eveningCheckInEnabled = useSettingsStore((s) => s.eveningCheckInEnabled);
  const eveningCheckInTime = useSettingsStore((s) => s.eveningCheckInTime);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const dayStateReady = useEventStore((s) => s.dayStateReady);
  const counterTotalsReady = useEventStore((s) => s.counterTotalsReady);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const dailyTotals = useEventStore((s) => s.dailyTotals);
  const loadHabitDayState = useEventStore((s) => s.loadHabitDayState);
  const loadCounterTotals = useEventStore((s) => s.loadCounterTotals);

  // Warm day/counter maps when evening check-in is on so digests don't wait on tab focus.
  useEffect(() => {
    if (!settingsLoaded || !elementsLoaded || !eveningCheckInEnabled) {
      return;
    }

    const habitInputs = habitStreakInputsFromElements(getActiveHabits(elements, dashboard));
    const counterIds = getActiveCounters(elements, dashboard).map((element) => element.id);
    void loadHabitDayState(habitInputs);
    void loadCounterTotals(counterIds);
  }, [
    elements,
    dashboard,
    elementsLoaded,
    eveningCheckInEnabled,
    settingsLoaded,
    loadHabitDayState,
    loadCounterTotals,
  ]);

  useEffect(() => {
    if (!settingsLoaded || !isNotificationsNativeAvailable()) {
      return;
    }

    if (!eveningCheckInEnabled) {
      void cancelAllHabitReminders().catch((error) => {
        console.warn('Tracker reminder cancel skipped', error);
      });
      return;
    }

    // If day state is not warm yet, schedule as if nothing is done; resync when ready.
    const doneMap = dayStateReady ? habitDoneToday : {};

    void syncHabitReminders(elements, true, doneMap).catch((error) => {
      console.warn('Habit start reminder sync skipped', error);
    });
  }, [
    elements,
    eveningCheckInEnabled,
    habitDoneToday,
    dayStateReady,
    appLanguage,
    settingsLoaded,
  ]);

  useEffect(() => {
    if (!settingsLoaded || !isNotificationsNativeAvailable()) {
      return;
    }

    if (!eveningCheckInEnabled) {
      return;
    }

    // Always schedule when enabled. Live count is best-effort when both maps are warm;
    // otherwise use the generic body so we never cancel tomorrow's check-in.
    const totalsReady = dayStateReady && counterTotalsReady;
    const unfinishedCount = totalsReady
      ? countUnfinishedTrackersToday({
          elements,
          habitDoneToday,
          dailyTotals,
        }).total
      : undefined;

    void scheduleEndOfDayReminder(true, eveningCheckInTime, unfinishedCount).catch((error) => {
      console.warn('Evening check-in sync skipped', error);
    });
  }, [
    dayStateReady,
    counterTotalsReady,
    elements,
    habitDoneToday,
    dailyTotals,
    eveningCheckInEnabled,
    eveningCheckInTime,
    appLanguage,
    settingsLoaded,
  ]);
}
