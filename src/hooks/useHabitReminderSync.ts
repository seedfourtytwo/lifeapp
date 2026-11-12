import { useEffect } from 'react';
import { resolveLanguage } from '../i18n';
import {
  cancelHabitStartReminders,
  requestNotificationPermissions,
} from '../notifications/habitReminders';
import { buildReminderPlan } from '../notifications/reminderPlan';
import { useElementStore } from '../store/elementStore';
import { useNotificationPermissionStore } from '../store/notificationPermissionStore';
import { useSettingsStore } from '../store/settingsStore';
import { writeReminderPlan } from '../widget/reminderPlanWriter';

/** A burst of store writes (an edit, its reload) should cost one write. */
const SETTLE_MS = 1500;

/**
 * Everything the plan holds, as one comparable string: the switch, the
 * language, notification permission, and each habit's name, config and
 * archived state. A tick or a new day is not in it: native judges those at
 * the moment a reminder is due.
 */
function planKey(): string | null {
  const { elements, isLoaded: elementsLoaded } = useElementStore.getState();
  const { trackerRemindersEnabled, appLanguage, isLoaded: settingsLoaded } =
    useSettingsStore.getState();
  // Until both have loaded, an empty list means "not read yet", not "no habits".
  if (!elementsLoaded || !settingsLoaded) return null;
  const habits = elements
    .filter((element) => element.kind === 'habit')
    .map((h) => [h.id, h.name, h.archivedAt ?? null, h.config]);
  return JSON.stringify([
    trackerRemindersEnabled,
    appLanguage,
    useNotificationPermissionStore.getState().permission?.status ?? null,
    habits,
  ]);
}

async function writePlan(): Promise<void> {
  const { trackerRemindersEnabled, appLanguage } = useSettingsStore.getState();
  const granted = trackerRemindersEnabled && (await requestNotificationPermissions());
  await writeReminderPlan(
    buildReminderPlan({
      elements: useElementStore.getState().elements,
      enabled: granted,
      language: resolveLanguage(appLanguage),
    }),
  );
}

/**
 * Before stage 6e the app queued two weeks of habit reminders in
 * expo-notifications. The native scheduler owns them now: cancel what the
 * old path left, once per launch, so nothing fires twice.
 */
let oldRemindersCancelled = false;

/** Writes one after another, so the last plan is the one on disk. */
let writing: Promise<void> = Promise.resolve();

/**
 * Keep the native reminder plan in step with the stores, until the returned
 * function is called. Subscribes rather than renders: none of this affects
 * what is on screen.
 */
export function watchHabitReminders(): () => void {
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastKey: string | null = null;
  let stopped = false;

  if (!oldRemindersCancelled) {
    oldRemindersCancelled = true;
    void cancelHabitStartReminders().catch((error: unknown) => {
      console.warn('Old habit reminders not cancelled', error);
    });
  }

  const evaluate = () => {
    if (stopped) return;
    const key = planKey();
    if (key === null || key === lastKey) return;
    lastKey = key;
    writing = writing.then(writePlan).catch((error: unknown) => {
      console.warn('Reminder plan not written', error);
    });
  };

  const scheduleEvaluate = () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(evaluate, SETTLE_MS);
  };

  evaluate();

  const unsubscribes = [
    useElementStore.subscribe(scheduleEvaluate),
    useSettingsStore.subscribe(scheduleEvaluate),
    useNotificationPermissionStore.subscribe(scheduleEvaluate),
  ];

  return () => {
    stopped = true;
    if (settleTimer) clearTimeout(settleTimer);
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

/** Sole owner of the reminder plan. */
export function useHabitReminderSync(): void {
  useEffect(() => watchHabitReminders(), []);
}
