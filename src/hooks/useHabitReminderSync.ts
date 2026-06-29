import { useEffect } from 'react';
import { HabitConfigSchema, isHabitDueToday, toDateString } from '../protocol';
import {
  isNotificationsNativeAvailable,
  scheduleEndOfDayReminder,
  syncHabitReminders,
} from '../notifications/habitReminders';
import { useElementStore } from '../store/elementStore';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';

export function useHabitReminderSync(): void {
  const elements = useElementStore((s) => s.elements);
  const habitRemindersEnabled = useSettingsStore((s) => s.habitRemindersEnabled);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const loadHabitDayState = useEventStore((s) => s.loadHabitDayState);

  useEffect(() => {
    if (!settingsLoaded) return;

    const habitElements = elements.filter((element) => element.kind === 'habit');
    const inputs = habitStreakInputsFromElements(habitElements);
    if (inputs.length > 0) {
      void loadHabitDayState(inputs);
    }

    const now = new Date();
    const today = toDateString(now);
    const undoneCount = habitElements.filter((habit) => {
      const config = HabitConfigSchema.parse(habit.config);
      if (!isHabitDueToday(config, { now, today })) return false;
      return !(habitDoneToday[habit.id] ?? false);
    }).length;

    if (!habitRemindersEnabled || !isNotificationsNativeAvailable()) {
      return;
    }

    void (async () => {
      try {
        await syncHabitReminders(elements, habitRemindersEnabled);
        await scheduleEndOfDayReminder(habitRemindersEnabled, undoneCount);
      } catch (error) {
        console.warn('Habit reminder sync skipped', error);
      }
    })();
  }, [elements, habitDoneToday, habitRemindersEnabled, loadHabitDayState, settingsLoaded]);
}
