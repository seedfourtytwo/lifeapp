import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  isNotificationsNativeAvailable,
  scheduleEndOfDayReminder,
} from '../notifications/habitReminders';
import { countUnfinishedTrackersToday } from '../notifications/unfinishedTrackers';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTodoStore } from '../store/todoStore';

/** A burst of counter taps should cost one evaluation, not one per tap. */
const SETTLE_MS = 1500;

function unfinishedTotal(): number {
  const { elements } = useElementStore.getState();
  const { habitDoneToday, dailyTotals } = useEventStore.getState();
  const { todos } = useTodoStore.getState();

  return countUnfinishedTrackersToday({ elements, habitDoneToday, dailyTotals, todos }).total;
}

/**
 * Sole owner of the evening check-in schedule.
 *
 * This runs at the app root, so it deliberately reads the stores through
 * `subscribe` rather than through hooks: the counts it needs live in the
 * highest-churn slices there are (`dailyTotals` moves on every counter tap),
 * and subscribing to those from the root would re-render every Home tab each
 * time. Nothing here affects what is on screen — only what the notification
 * will say — so it belongs off the render path entirely.
 */
export function useEveningCheckInSync(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const enabled = useSettingsStore((s) => s.eveningCheckInEnabled);
  const time = useSettingsStore((s) => s.eveningCheckInTime);
  const appLanguage = useSettingsStore((s) => s.appLanguage);

  useEffect(() => {
    if (!settingsLoaded || !isNotificationsNativeAvailable()) return;

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTotal: number | null = null;
    let cancelled = false;

    const evaluate = () => {
      if (cancelled) return;
      const total = unfinishedTotal();
      // The daily trigger is unchanged; only the wording depends on the count.
      if (total === lastTotal) return;
      lastTotal = total;
      void scheduleEndOfDayReminder(enabled, time, total).catch((error) => {
        console.warn('Evening check-in sync skipped', error);
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
      useTodoStore.subscribe(scheduleEvaluate),
    ];

    // An app left open overnight must not still announce yesterday's number.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      lastTotal = null;
      evaluate();
    });

    return () => {
      cancelled = true;
      if (settleTimer) clearTimeout(settleTimer);
      for (const unsubscribe of unsubscribes) unsubscribe();
      appStateSub.remove();
    };
  }, [settingsLoaded, enabled, time, appLanguage]);
}
