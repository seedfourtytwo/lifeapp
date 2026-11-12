import { i18n } from '../i18n';
import { DEFAULT_EVENING_CHECK_IN_TIME, parseEveningCheckInTime } from '../protocol/appSettings';
import {
  cancelScheduledWithPrefix,
  getNotifications,
  isNotificationsNativeAvailable,
  requestNotificationPermissions,
  REMINDERS_CHANNEL_ID,
} from './notificationsBootstrap.native';

export { isNotificationsNativeAvailable, requestNotificationPermissions };

/**
 * The evening check-in, on expo-notifications. Habit reminders are the
 * native scheduler's (`modules/life-core`, fed by `useHabitReminderSync`);
 * what is left here of them is the clean-up of the ones this file used to queue.
 */

const REMINDER_PREFIX = 'habit-reminder-';
const END_OF_DAY_REMINDER_ID = `${REMINDER_PREFIX}eod`;
let endOfDayChain: Promise<void> = Promise.resolve();

function parseCheckInHourMinute(timeHHmm: string): { hour: number; minute: number } {
  const parsed = parseEveningCheckInTime(timeHHmm) ?? DEFAULT_EVENING_CHECK_IN_TIME;
  const [hour, minute] = parsed.split(':').map(Number);
  return { hour, minute };
}

/** Cancel every habit reminder queued in expo-notifications before stage 6e; the check-in stays. */
export async function cancelHabitStartReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await cancelScheduledWithPrefix(Notifications, REMINDER_PREFIX, {
    keep: (id) => id === END_OF_DAY_REMINDER_ID,
  });
}

/**
 * Schedule the recurring evening check-in.
 * Always schedules when enabled — local DAILY triggers cannot reliably mean
 * "only if unfinished" without cancelling tomorrow's fire. Body uses a live
 * unfinished count when provided (> 0); otherwise a generic prompt. Calls
 * run one after another, so the last one called is what stays pending.
 */
export function scheduleEndOfDayReminder(
  enabled: boolean,
  timeHHmm: string = DEFAULT_EVENING_CHECK_IN_TIME,
  unfinishedCount?: number,
): Promise<void> {
  const run = async (): Promise<void> => {
    if (!isNotificationsNativeAvailable()) return;

    const Notifications = await getNotifications();
    if (!Notifications) return;

    await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_REMINDER_ID);
    if (!enabled) return;

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const { hour, minute } = parseCheckInHourMinute(timeHHmm);
    const hasCount = unfinishedCount !== undefined && unfinishedCount > 0;

    await Notifications.scheduleNotificationAsync({
      identifier: END_OF_DAY_REMINDER_ID,
      content: {
        title: i18n.t('notifications:eveningCheckIn.title'),
        body: hasCount
          ? i18n.t(
              unfinishedCount === 1
                ? 'notifications:eveningCheckIn.bodyOne'
                : 'notifications:eveningCheckIn.bodyMany',
              { count: unfinishedCount },
            )
          : i18n.t('notifications:eveningCheckIn.bodyGeneric'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  };
  const next = endOfDayChain.then(run, run);
  endOfDayChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
