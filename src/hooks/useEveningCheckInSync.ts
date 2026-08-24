import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import {
  isNotificationsNativeAvailable,
  scheduleEndOfDayReminder,
} from '../notifications/habitReminders';
import { countUnfinishedTrackersToday } from '../notifications/unfinishedTrackers';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';

function scheduleFromCurrentState(): void {
  const settings = useSettingsStore.getState();
  const { elements } = useElementStore.getState();
  const { habitDoneToday, dailyTotals } = useEventStore.getState();
  const { todos } = useTodoStore.getState();

  const counts = countUnfinishedTrackersToday({
    elements,
    habitDoneToday,
    dailyTotals,
    todos,
  });

  schedule(settings.eveningCheckInEnabled, settings.eveningCheckInTime, counts.total);
}

function schedule(enabled: boolean, time: string, total: number): void {
  void scheduleEndOfDayReminder(enabled, time, total).catch((error) => {
    console.warn('Evening check-in sync skipped', error);
  });
}

/**
 * Sole owner of the evening check-in schedule.
 *
 * The trigger is a daily local notification that always fires when enabled —
 * the count only decides the wording, so the schedule is rewritten whenever
 * what is outstanding changes, and again on foreground so an app left open
 * overnight does not announce yesterday's number.
 */
export function useEveningCheckInSync(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const enabled = useSettingsStore((s) => s.eveningCheckInEnabled);
  const time = useSettingsStore((s) => s.eveningCheckInTime);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const elements = useElementStore((s) => s.elements);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const dailyTotals = useEventStore((s) => s.dailyTotals);
  const todos = useTodoStore((s) => s.todos);

  // Depend on the count, not on the stores behind it: logging the same counter
  // ten times moves dailyTotals ten times but usually leaves the count alone,
  // and each change would otherwise rewrite the OS schedule.
  const total = useMemo(
    () =>
      countUnfinishedTrackersToday({ elements, habitDoneToday, dailyTotals, todos }).total,
    [elements, habitDoneToday, dailyTotals, todos],
  );

  useEffect(() => {
    if (!settingsLoaded || !isNotificationsNativeAvailable()) return;
    schedule(enabled, time, total);
  }, [settingsLoaded, enabled, time, appLanguage, total]);

  useEffect(() => {
    if (!settingsLoaded || !isNotificationsNativeAvailable()) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      scheduleFromCurrentState();
    });

    return () => sub.remove();
  }, [settingsLoaded]);
}
