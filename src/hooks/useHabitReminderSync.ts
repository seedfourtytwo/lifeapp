import { useEffect } from 'react';
import { isHabitDueToday, parseHabitConfig, toDateString } from '../protocol';
import {
  cancelAllHabitReminders,
  isNotificationsNativeAvailable,
  scheduleEndOfDayReminder,
  syncHabitReminders,
} from '../notifications/habitReminders';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { isElementArchived } from '../utils/dashboardElements';

export function useHabitReminderSync(): void {
  const elements = useElementStore((s) => s.elements);
  const habitRemindersEnabled = useSettingsStore((s) => s.habitRemindersEnabled);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const dayStateReady = useEventStore((s) => s.dayStateReady);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);

  useEffect(() => {
    if (!settingsLoaded || !isNotificationsNativeAvailable()) {
      return;
    }

    if (!habitRemindersEnabled) {
      void cancelAllHabitReminders().catch((error) => {
        console.warn('Habit reminder cancel skipped', error);
      });
      return;
    }

    void syncHabitReminders(elements, true).catch((error) => {
      console.warn('Habit reminder sync skipped', error);
    });
  }, [elements, habitRemindersEnabled, appLanguage, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || !isNotificationsNativeAvailable() || !dayStateReady) {
      return;
    }

    if (!habitRemindersEnabled) {
      return;
    }

    const now = new Date();
    const today = toDateString(now);
    const habitElements = elements.filter(
      (element) => element.kind === 'habit' && !isElementArchived(element),
    );
    const undoneCount = habitElements.filter((habit) => {
      const config = parseHabitConfig(habit.config);
      if (!isHabitDueToday(config, { now, today })) return false;
      return !(habitDoneToday[habit.id] ?? false);
    }).length;

    void scheduleEndOfDayReminder(true, undoneCount).catch((error) => {
      console.warn('End-of-day reminder sync skipped', error);
    });
  }, [
    dayStateReady,
    elements,
    habitDoneToday,
    habitRemindersEnabled,
    appLanguage,
    settingsLoaded,
  ]);
}
