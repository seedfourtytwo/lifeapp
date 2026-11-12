import { useEffect, useMemo, useRef } from 'react';
import { lifeCore } from '../core/lifeCore';
import { useCalendarStore } from '../store/calendarStore';
import { useElementStore } from '../store/elementStore';
import { useTodoStore } from '../store/todoStore';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getActiveHabits } from '../utils/dashboardElements';
import { drainPendingWidgetActions } from '../widget/pendingWidgetActions';
import { installWidgetSnapshotWriter } from '../widget/widgetSnapshotWriter';
import { refreshFromDb } from './refreshFromDb';
import { markStartupDone } from './startupGate';

/**
 * Identity of active habits that should reload streaks.
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

/** Start-up work runs unawaited; a failure is logged and the app carries on without it. */
function warnStartupFailure(step: string): (error: unknown) => void {
  return (error) => {
    console.warn(`Start-up step failed: ${step}`, error);
  };
}

/**
 * Loads settings, elements, todos and habit streaks at app start, mirrors the
 * native timer, and follows it: every transition the core reports (a tap in
 * the app, the notification's Pause or Done, a track's end) and every tap
 * the widget queues drains the queue and refreshes from SQLite.
 */
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
  const didStartRef = useRef(false);
  const didMarkStartupRef = useRef(false);

  const bootstrapKey = useMemo(
    () => activeHabitBootstrapKey(elements, dashboard),
    [elements, dashboard],
  );

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const subscription = lifeCore.addStateListener((state) => {
      void useEventStore
        .getState()
        .syncTimerFromCore(state)
        .then(refreshFromDb)
        .catch(warnStartupFailure('timer state change'));
    });
    // A widget tap while the app runs: drain it now, not at the next return to the app.
    const queued = lifeCore.addQueueListener(() => {
      refreshFromDb().catch(warnStartupFailure('widget tap'));
    });
    return () => {
      subscription.remove();
      queued.remove();
    };
  }, []);

  useEffect(() => installWidgetSnapshotWriter(), []);

  useEffect(() => {
    if (!settingsLoaded) return;
    void loadElements();
    void useCalendarStore.getState().load();
    // Loaded at boot, not on tab focus: the evening check-in counts todos due
    // today whether or not you have opened the Todos tab.
    void useTodoStore.getState().load();
  }, [loadElements, settingsLoaded]);

  // Element load failed — don't leave work waiting for start-up forever.
  useEffect(() => {
    if (!settingsLoaded || !elementsError || didMarkStartupRef.current) return;
    didMarkStartupRef.current = true;
    markStartupDone();
  }, [elementsError, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || elementsLoading) return;

    const { elements: latestElements, dashboard: latestDashboard } = useElementStore.getState();
    const habitElements = getActiveHabits(latestElements, latestDashboard);
    if (habitElements.length === 0) return;

    const inputs = habitStreakInputsFromElements(habitElements);
    // Day-state is loaded on Habits focus — avoid a duplicate cold-start query.
    loadHabitStreaks(inputs).catch(warnStartupFailure('habit streaks'));
  }, [bootstrapKey, elementsLoading, loadHabitStreaks, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || !elementsLoaded || elementsLoading || didStartRef.current) return;
    didStartRef.current = true;
    (async () => {
      try {
        // A session a dead process left running comes back paused at its last heartbeat.
        await useEventStore.getState().reloadActiveTimerSessions();
        const { elements: latestElements, dashboard: latestDashboard } =
          useElementStore.getState();
        const habitElements = getActiveHabits(latestElements, latestDashboard);
        if (habitElements.length > 0) {
          await useEventStore
            .getState()
            .loadHabitDayState(habitStreakInputsFromElements(habitElements));
        }
        // Taps and finished sessions queued while the app was not running.
        await drainPendingWidgetActions();
      } finally {
        didMarkStartupRef.current = true;
        markStartupDone();
      }
    })().catch(warnStartupFailure('timer state, day state and widget actions'));
  }, [elementsLoaded, elementsLoading, settingsLoaded]);
}
