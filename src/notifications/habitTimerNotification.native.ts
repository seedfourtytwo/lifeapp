import { i18n } from '../i18n';
import type { HabitTimerTargetFire } from './habitTimerTarget';
import {
  cancelScheduledWithPrefix,
  getNotifications,
  REMINDERS_CHANNEL_ID,
  requestNotificationPermissions,
} from './notificationsBootstrap.native';

const TIMER_PREFIX = 'habit-timer-';

let chain: Promise<void> = Promise.resolve();

/**
 * Make the one pending timer notification match `target`: none, or one at the
 * moment the running timer reaches its target. Anything else with the prefix,
 * including one left by an earlier run of the app, is cancelled.
 *
 * The DATE trigger goes through expo-notifications' `setupAlarm`, which uses
 * `setExactAndAllowWhileIdle` whenever `canScheduleExactAlarms()` is true —
 * which USE_EXACT_ALARM in app.json makes so on Android 13+.
 */
export function syncHabitTimerNotification(target: HabitTimerTargetFire | null): Promise<void> {
  const work = async (): Promise<void> => {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    const identifier = target ? `${TIMER_PREFIX}${target.elementId}` : null;
    await cancelScheduledWithPrefix(Notifications, TIMER_PREFIX, {
      keep: (id) => id === identifier,
    });
    if (!target || !identifier) return;
    if (!(await requestNotificationPermissions())) return;

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: i18n.t('notifications:habitTimer.title'),
        body: i18n.t('notifications:habitTimer.body', { name: target.name }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target.fireAt,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  };
  const next = chain.then(work, work);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
