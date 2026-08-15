import { useEffect, useMemo, useRef } from 'react';
import {
  installHabitTimerRemoteControls,
  restoreHabitTimerPlaybackAfterHydration,
} from '../habits/habitTimerRemote';
import { warmupHabitSoundPlayback } from '../audio/habitTimerSound';
import { warmupHabitCompleteChime } from '../audio/habitCompleteSound';
import { preloadConfiguredHabitSounds } from '../audio/preloadConfiguredHabitSounds';
import { useCalendarStore } from '../store/calendarStore';
import { useElementStore } from '../store/elementStore';
import {
  habitStreakInputsFromElements,
  releaseActiveTimersReady,
  useEventStore,
} from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getActiveHabits } from '../utils/dashboardElements';
import { cancelAllHabitReminders } from '../notifications/habitReminders';

/**
 * Identity of active habits that should reload streaks / warm sounds.
 * Includes config so target/schedule edits refresh streaks without renaming thrashing
 * day-state (focus refresh owns today's completion map).
 */
function activeHabitBootstrapKey(
  elements: ReturnType<typeof useElementStore.getState>['elements'],
  dashboard: ReturnType<typeof useElementStore.getState>['dashboard'],
): string {
  return getActiveHabits(elements, dashboard)
    .map((habit) => `${habit.id}:${JSON.stringify(habit.config)}`)
    .sort()
    .join('|');
}

/** Loads settings, elements, habit streaks, and warms timer sounds at app start. */
export function useAppBootstrap(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadElements = useElementStore((s) => s.load);
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const elementsLoading = useElementStore((s) => s.isLoading);
  const elementsLoaded = useElementStore((s) => s.isLoaded);
  const elementsError = useElementStore((s) => s.error);
  const loadHabitStreaks = useEventStore((s) => s.loadHabitStreaks);
  const hydrateActiveTimerSessions = useEventStore((s) => s.hydrateActiveTimerSessions);
  const didRestoreTimersRef = useRef(false);
  const didReleaseTimersReadyRef = useRef(false);

  const bootstrapKey = useMemo(
    () => activeHabitBootstrapKey(elements, dashboard),
    [elements, dashboard],
  );

  useEffect(() => {
    installHabitTimerRemoteControls();
    void loadSettings();
    void warmupHabitSoundPlayback();
    void warmupHabitCompleteChime();
    // Evening check-in is parked; clear any leftover OS notifications.
    void cancelAllHabitReminders().catch((error) => {
      console.warn('Parked habit reminder cancel skipped', error);
    });
  }, [loadSettings]);

  useEffect(() => {
    if (!settingsLoaded) return;
    void loadElements();
    void useCalendarStore.getState().load();
  }, [loadElements, settingsLoaded]);

  // Element load failed — don't leave timer starts hanging forever.
  useEffect(() => {
    if (!settingsLoaded || !elementsError || didReleaseTimersReadyRef.current) return;
    didReleaseTimersReadyRef.current = true;
    releaseActiveTimersReady();
  }, [elementsError, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || elementsLoading) return;

    const { elements: latestElements, dashboard: latestDashboard } = useElementStore.getState();
    const habitElements = getActiveHabits(latestElements, latestDashboard);
    if (habitElements.length === 0) return;

    const inputs = habitStreakInputsFromElements(habitElements);
    // Day-state is loaded on Habits focus — avoid a duplicate cold-start query.
    void loadHabitStreaks(inputs);
    void preloadConfiguredHabitSounds(habitElements);
  }, [bootstrapKey, elementsLoading, loadHabitStreaks, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || !elementsLoaded || elementsLoading || didRestoreTimersRef.current) {
      return;
    }
    didRestoreTimersRef.current = true;
    void (async () => {
      try {
        await hydrateActiveTimerSessions();
        const sessionsAfterHydrate = {
          ...useEventStore.getState().activeTimerSessions,
        };
        // Day totals must be warm before lock-screen Done can update completion correctly.
        const { elements: latestElements, dashboard: latestDashboard } =
          useElementStore.getState();
        const habitElements = getActiveHabits(latestElements, latestDashboard);
        if (habitElements.length > 0) {
          await useEventStore
            .getState()
            .loadHabitDayState(habitStreakInputsFromElements(habitElements));
        }
        // If the user started/changed a timer during day-state load, don't reset audio.
        const sessionsNow = useEventStore.getState().activeTimerSessions;
        if (JSON.stringify(sessionsNow) === JSON.stringify(sessionsAfterHydrate)) {
          await restoreHabitTimerPlaybackAfterHydration();
        }
      } finally {
        didReleaseTimersReadyRef.current = true;
        releaseActiveTimersReady();
      }
    })();
  }, [elementsLoaded, elementsLoading, hydrateActiveTimerSessions, settingsLoaded]);
}
