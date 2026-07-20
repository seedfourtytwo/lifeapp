import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useCalendarStore } from '../store/calendarStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  isNotificationsNativeAvailable,
  syncCalendarReminders,
} from '../notifications/calendarReminders';

/**
 * Sole owner of calendar local-notification schedules.
 * Reacts to calendarStore mutations (and AppState foreground) — stores must not call sync themselves.
 */
export function useCalendarReminderSync(): void {
  const isLoaded = useCalendarStore((s) => s.isLoaded);
  const events = useCalendarStore((s) => s.events);
  const calendars = useCalendarStore((s) => s.calendars);
  const reminders = useCalendarStore((s) => s.reminders);
  const clearedByKey = useCalendarStore((s) => s.clearedByKey);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);

  useEffect(() => {
    if (!settingsLoaded || !isLoaded || !isNotificationsNativeAvailable()) return;

    void syncCalendarReminders({
      events,
      calendars,
      reminders,
      clearedOccurrenceKeys: new Set(Object.keys(clearedByKey)),
    }).catch((error) => {
      console.warn('Calendar reminder sync skipped', error);
    });
  }, [calendars, clearedByKey, events, isLoaded, reminders, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || !isLoaded || !isNotificationsNativeAvailable()) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const snap = useCalendarStore.getState();
      void syncCalendarReminders({
        events: snap.events,
        calendars: snap.calendars,
        reminders: snap.reminders,
        clearedOccurrenceKeys: new Set(Object.keys(snap.clearedByKey)),
      }).catch((error) => {
        console.warn('Calendar reminder foreground sync skipped', error);
      });
    });

    return () => sub.remove();
  }, [isLoaded, settingsLoaded]);
}
