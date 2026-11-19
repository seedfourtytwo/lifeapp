import { useEffect, useMemo, useRef } from 'react';
import {
  installHabitTimerRemoteControls,
  restoreHabitTimerPlaybackAfterHydration,
} from '../kinds/habit/habitTimerRemote';
import { warmupHabitSoundPlayback } from '../audio/habitTimerSound';
import { warmupHabitCompleteChime } from '../audio/habitCompleteSound';
import { preloadConfiguredHabitSounds } from '../audio/preloadConfiguredHabitSounds';
import { useCalendarStore } from '../store/calendarStore';
import { useElementStore } from '../store/elementStore';
import { useTodoStore } from '../store/todoStore';
import {
  habitStreakInputsFromElements,
  releaseActiveTimersReady,
  useEventStore,
} from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getActiveHabits } from '../utils/dashboardElements';

/**
 * Identity of active habits whose sounds should be warmed. Includes config so a
 * sound change re-runs the preload. Streaks and today's completion map are
 * loaded by the Home focus refresh (`useRefreshHabitDayOnFocus`), not here.
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

/** Loads settings, elements, todos, and warms timer sounds at app start. */
export function useAppBootstrap(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadElements = useElementStore((s) => s.load);
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const elementsLoading = useElementStore((s) => s.isLoading);
  const elementsLoaded = useElementStore((s) => s.isLoaded);
  const elementsError = useElementStore((s) => s.error);
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
  }, [loadSettings]);

  useEffect(() => {
    if (!settingsLoaded) return;
    void loadElements();
    void useCalendarStore.getState().load();
    // Loaded at boot, not on tab focus: the evening check-in counts todos due
    // today whether or not you have opened the Today page.
    void useTodoStore.getState().load();
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

    // Streaks load on Home focus once elements land — a load here too ran the
    // same streak query twice on every cold start.
    void preloadConfiguredHabitSounds(habitElements);
  }, [bootstrapKey, elementsLoading, settingsLoaded]);

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
        // Skip when the Home focus load already landed; an identical load still
        // in flight is joined rather than repeated (see `joinInFlightLoad`).
        if (habitElements.length > 0 && !useEventStore.getState().dayStateReady) {
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
