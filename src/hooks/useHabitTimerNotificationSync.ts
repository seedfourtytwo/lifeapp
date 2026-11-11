import { useEffect } from 'react';
import { syncHabitTimerNotification } from '../notifications/habitTimerNotification';
import { habitTimerTargetFire } from '../notifications/habitTimerTarget';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Keep the "target reached" notification on the running timer, until the
 * returned function is called. Every timer transition — start, pause,
 * resume, finish, reset, discard, another timer taking over — is a change to
 * the sessions in the event store, so one subscription covers them all.
 */
export function watchHabitTimerNotification(): () => void {
  let lastKey: string | undefined;

  const evaluate = () => {
    const { activeTimerSessions, dailyTotals, dayMapsDate } = useEventStore.getState();
    const target = habitTimerTargetFire({
      sessions: activeTimerSessions,
      elements: useElementStore.getState().elements,
      dailyTotals,
      dayMapsDate,
    });
    const key = JSON.stringify([
      target?.elementId ?? null,
      target?.fireAt.getTime() ?? null,
      target?.name ?? null,
      useSettingsStore.getState().appLanguage,
    ]);
    if (key === lastKey) return;
    lastKey = key;
    void syncHabitTimerNotification(target).catch((error) => {
      console.warn('Timer notification sync skipped', error);
    });
  };

  evaluate();
  const unsubscribes = [
    useEventStore.subscribe(evaluate),
    useElementStore.subscribe(evaluate),
    useSettingsStore.subscribe(evaluate),
  ];
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

/** Sole owner of the timer target notification. */
export function useHabitTimerNotificationSync(): void {
  useEffect(() => watchHabitTimerNotification(), []);
}
