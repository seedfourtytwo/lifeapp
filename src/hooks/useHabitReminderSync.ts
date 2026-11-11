import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncHabitReminders } from '../notifications/habitReminders';
import { toDateString } from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useNotificationPermissionStore } from '../store/notificationPermissionStore';
import { useSettingsStore } from '../store/settingsStore';

/** A burst of store writes (a tick, its streak reload) should cost one sync. */
const SETTLE_MS = 1500;

/**
 * Everything a habit reminder depends on, as one comparable string: the day,
 * the switch, language and notification permission, and for each habit its name, config, archived
 * state and whether it is done today. Anything else changing is no reason to
 * touch the scheduler.
 */
function reminderInputs(now: Date): { key: string; done: Record<string, boolean> } | null {
  const { elements, isLoaded: elementsLoaded } = useElementStore.getState();
  const { trackerRemindersEnabled, appLanguage, isLoaded: settingsLoaded } =
    useSettingsStore.getState();
  // Until both have loaded, an empty list means "not read yet", not "no habits".
  if (!elementsLoaded || !settingsLoaded) return null;

  const today = toDateString(now);
  const { habitDoneToday, dayMapsDate, dayStateReady } = useEventStore.getState();
  // A done map from another day says nothing about today.
  const done = dayStateReady && dayMapsDate === today ? habitDoneToday : {};
  const habits = elements
    .filter((element) => element.kind === 'habit')
    .map((h) => [h.id, h.name, h.archivedAt ?? null, h.config, done[h.id] ?? false]);
  return {
    key: JSON.stringify([
      today,
      trackerRemindersEnabled,
      appLanguage,
      useNotificationPermissionStore.getState().permission?.status ?? null,
      habits,
    ]),
    done,
  };
}

/**
 * Keep the pending habit reminders in step with the stores, until the
 * returned function is called. Subscribes rather than renders, like the
 * evening check-in: the event store changes on every tap, and none of this
 * affects what is on screen.
 */
export function watchHabitReminders(): () => void {
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastKey: string | null = null;
  let stopped = false;

  const evaluate = () => {
    if (stopped) return;
    const now = new Date();
    const inputs = reminderInputs(now);
    if (!inputs || inputs.key === lastKey) return;
    lastKey = inputs.key;
    const { elements } = useElementStore.getState();
    const { trackerRemindersEnabled } = useSettingsStore.getState();
    void syncHabitReminders(elements, trackerRemindersEnabled, inputs.done, now).catch((error) => {
      console.warn('Habit reminder sync skipped', error);
    });
  };

  const scheduleEvaluate = () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(evaluate, SETTLE_MS);
  };

  evaluate();

  const unsubscribes = [
    useElementStore.subscribe(scheduleEvaluate),
    useEventStore.subscribe(scheduleEvaluate),
    useSettingsStore.subscribe(scheduleEvaluate),
    useNotificationPermissionStore.subscribe(scheduleEvaluate),
  ];

  // Opening the app rolls the two-week window forward even if nothing changed.
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    lastKey = null;
    evaluate();
  });

  return () => {
    stopped = true;
    if (settleTimer) clearTimeout(settleTimer);
    for (const unsubscribe of unsubscribes) unsubscribe();
    appStateSub.remove();
  };
}

/** Sole owner of per-habit reminder schedules. */
export function useHabitReminderSync(): void {
  useEffect(() => watchHabitReminders(), []);
}
