import { useEffect } from 'react';
import { isHabitDueToday, parseHabitConfig, toDateString } from '../protocol';
import {
  isNotificationsNativeAvailable,
  scheduleEndOfDayReminder,
  syncHabitReminders,
} from '../notifications/habitReminders';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';

export function useHabitReminderSync(): void {
  const elements = useElementStore((s) => s.elements);
  const habitRemindersEnabled = useSettingsStore((s) => s.habitRemindersEnabled);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);

  useEffect(() => {
    if (!settingsLoaded || !habitRemindersEnabled || !isNotificationsNativeAvailable()) {
      return;
    }

    void syncHabitReminders(elements, habitRemindersEnabled).catch((error) => {
      console.warn('Habit reminder sync skipped', error);
    });
  }, [elements, habitRemindersEnabled, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || !habitRemindersEnabled || !isNotificationsNativeAvailable()) {
      return;
    }

    const now = new Date();
    const today = toDateString(now);
    const habitElements = elements.filter((element) => element.kind === 'habit');
    const undoneCount = habitElements.filter((habit) => {
      const config = parseHabitConfig(habit.config);
      if (!isHabitDueToday(config, { now, today })) return false;
      return !(habitDoneToday[habit.id] ?? false);
    }).length;

    void scheduleEndOfDayReminder(habitRemindersEnabled, undoneCount).catch((error) => {
      console.warn('End-of-day reminder sync skipped', error);
    });
  }, [elements, habitDoneToday, habitRemindersEnabled, settingsLoaded]);
}
