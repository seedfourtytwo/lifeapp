import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  isNotificationsNativeAvailable,
  syncHabitReminders,
} from '../notifications/habitReminders';
import type { ElementDefinition } from '../protocol';
import { HabitConfigSchema } from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { isElementArchived } from '../utils/dashboardElements';
import { currentAppCalendarDate, msUntilNextAppDay } from '../utils/dayRollover';

/** A burst of edits / taps should cost one reschedule: sync cancels and rebuilds everything. */
export const HABIT_REMINDER_SETTLE_MS = 1500;

/**
 * Foreground top-up. The horizon is finite, so coming back re-extends it, but
 * not every unlock needs a full cancel-and-rebuild.
 */
export const HABIT_REMINDER_REFRESH_MS = 60 * 60 * 1000;

/**
 * Everything a reminder schedule depends on, as a string. Equal signatures mean
 * a resync would schedule exactly the same notifications, so it is skipped —
 * this is what keeps counter taps (which churn the event store) from rescheduling.
 */
export function habitReminderSignature(
  elements: ElementDefinition[],
  habitDoneToday: Record<string, boolean>,
  today: string,
  language: string,
  dayContext: {
    skipRowToday?: Record<string, boolean>;
    habitWeekDoneBefore?: Record<string, readonly string[]>;
  } = {},
): string {
  const parts: unknown[] = [today, language];
  for (const element of elements) {
    if (element.kind !== 'habit' || isElementArchived(element)) continue;
    const parsed = HabitConfigSchema.safeParse(element.config);
    if (!parsed.success) continue;
    const { timeRange, remindMinutesBefore, schedule } = parsed.data;
    if (!timeRange || remindMinutesBefore === undefined) continue;
    parts.push([
      element.id,
      element.name,
      timeRange,
      remindMinutesBefore,
      schedule,
      habitDoneToday[element.id] ?? false,
      // A skip drops today's reminder; a times-a-week habit's earlier done days
      // can drop the rest of the week's.
      dayContext.skipRowToday?.[element.id] ?? false,
      schedule.type === 'times_per_week'
        ? (dayContext.habitWeekDoneBefore?.[element.id] ?? [])
        : null,
    ]);
  }
  return JSON.stringify(parts);
}

/**
 * Sole owner of per-habit start-reminder schedules.
 *
 * Like the evening check-in it reads the stores through `subscribe` (the event
 * store churns on every counter tap) and keeps off the render path.
 *
 * `enabled` is always true: there is no global notifications switch (the
 * evening check-in toggle is its own thing), and a reminder only exists because
 * the user set `remindMinutesBefore` on that habit.
 *
 * Horizon: reminders are scheduled `START_REMINDER_HORIZON_DAYS` ahead. If the
 * app is not opened for longer than that, the queue simply runs dry and
 * reminders stop until the next launch tops it up.
 */
export function useHabitReminderSync(): void {
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const elementsLoaded = useElementStore((s) => s.isLoaded);
  const appLanguage = useSettingsStore((s) => s.appLanguage);

  useEffect(() => {
    if (!settingsLoaded || !elementsLoaded || !isNotificationsNativeAvailable()) return;

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSignature: string | null = null;
    let lastSyncAt = 0;
    let cancelled = false;

    const evaluate = (force = false) => {
      if (cancelled) return;
      const { elements } = useElementStore.getState();
      const { habitDoneToday, skipRowToday, habitWeekDoneBefore } = useEventStore.getState();
      const dayContext = { skipRowToday, habitWeekDoneBefore };
      const signature = habitReminderSignature(
        elements,
        habitDoneToday,
        currentAppCalendarDate(),
        appLanguage,
        dayContext,
      );
      const stale = Date.now() - lastSyncAt >= HABIT_REMINDER_REFRESH_MS;
      if (signature === lastSignature && !(force && stale)) return;
      lastSignature = signature;
      lastSyncAt = Date.now();
      void syncHabitReminders(elements, true, habitDoneToday, dayContext).catch((error) => {
        console.warn('Habit reminder sync skipped', error);
      });
    };

    const scheduleEvaluate = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => evaluate(), HABIT_REMINDER_SETTLE_MS);
    };

    // The date is part of the signature, so crossing midnight resyncs.
    const armMidnight = () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      midnightTimer = setTimeout(() => {
        scheduleEvaluate();
        armMidnight();
      }, msUntilNextAppDay() + 1_000);
    };

    scheduleEvaluate();
    armMidnight();

    const unsubscribes = [
      useElementStore.subscribe(scheduleEvaluate),
      useEventStore.subscribe(scheduleEvaluate),
    ];

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      armMidnight();
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => evaluate(true), HABIT_REMINDER_SETTLE_MS);
    });

    return () => {
      cancelled = true;
      if (settleTimer) clearTimeout(settleTimer);
      if (midnightTimer) clearTimeout(midnightTimer);
      for (const unsubscribe of unsubscribes) unsubscribe();
      appStateSub.remove();
    };
  }, [settingsLoaded, elementsLoaded, appLanguage]);
}

