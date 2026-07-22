import { NativeModules } from 'react-native';
import { i18n } from '../i18n';
import type { ElementDefinition, HabitConfig } from '../protocol';
import { HabitConfigSchema } from '../protocol';
import { DEFAULT_EVENING_CHECK_IN_TIME, parseEveningCheckInTime } from '../protocol/appSettings';
import { isScheduleSupportedForReminders } from '../protocol/schedule';
import { isElementArchived } from '../utils/dashboardElements';
import { collectStartReminderFires } from './habitStartReminderTimes';

const REMINDER_PREFIX = 'habit-reminder-';
const END_OF_DAY_REMINDER_ID = `${REMINDER_PREFIX}eod`;
let habitReminderSyncGeneration = 0;
let habitReminderSyncChain: Promise<void> = Promise.resolve();

function enqueueHabitReminderWork(work: () => Promise<void>): Promise<void> {
  const next = habitReminderSyncChain.then(work, work);
  habitReminderSyncChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
let notificationsUnavailable = false;

/** Avoid importing expo-notifications when the native module is missing (old dev client). */
export function isNotificationsNativeAvailable(): boolean {
  return NativeModules.ExpoPushTokenManager != null;
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (notificationsUnavailable || !isNotificationsNativeAvailable()) {
    notificationsUnavailable = true;
    return null;
  }
  if (notificationsModule) {
    return notificationsModule;
  }

  try {
    notificationsModule = await import('expo-notifications');
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return notificationsModule;
  } catch (error) {
    notificationsUnavailable = true;
    console.warn(
      'expo-notifications is unavailable; tracker reminders disabled until you rebuild the dev client.',
      error,
    );
    return null;
  }
}

function canScheduleStartReminder(config: HabitConfig): boolean {
  return (
    config.timeRange !== undefined &&
    config.remindMinutesBefore !== undefined &&
    config.remindMinutesBefore >= 0 &&
    isScheduleSupportedForReminders(config.schedule)
  );
}

function parseCheckInHourMinute(timeHHmm: string): { hour: number; minute: number } {
  const parsed = parseEveningCheckInTime(timeHHmm) ?? DEFAULT_EVENING_CHECK_IN_TIME;
  const [hour, minute] = parsed.split(':').map(Number);
  return { hour, minute };
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const result = await Notifications.requestPermissionsAsync();
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function cancelHabitStartRemindersWith(notifications: NotificationsModule): Promise<void> {
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const habitIds = scheduled
    .map((item) => item.identifier)
    .filter((id) => id.startsWith(REMINDER_PREFIX) && id !== END_OF_DAY_REMINDER_ID);
  await Promise.all(habitIds.map((id) => notifications.cancelScheduledNotificationAsync(id)));
}

export async function cancelHabitStartReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await cancelHabitStartRemindersWith(Notifications);
}

async function scheduleStartRemindersForHabit(
  notifications: NotificationsModule,
  element: ElementDefinition,
  config: HabitConfig,
  doneToday: boolean,
): Promise<void> {
  const fires = collectStartReminderFires(config, { doneToday });

  await Promise.all(
    fires.map((fire) =>
      notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_PREFIX}${element.id}-${fire.dateStr}`,
        content: {
          title: i18n.t('notifications:habitReminder.title'),
          body: i18n.t('notifications:habitReminder.body', { name: element.name }),
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DATE,
          date: fire.when,
        },
      }),
    ),
  );
}

export async function syncHabitReminders(
  elements: ElementDefinition[],
  enabled: boolean,
  habitDoneToday: Record<string, boolean> = {},
): Promise<void> {
  const run = async (): Promise<void> => {
    if (!isNotificationsNativeAvailable()) {
      return;
    }

    const Notifications = await getNotifications();
    if (!Notifications) return;

    const generation = ++habitReminderSyncGeneration;
    await cancelHabitStartRemindersWith(Notifications);
    if (generation !== habitReminderSyncGeneration) return;

    if (!enabled) {
      return;
    }

    const granted = await requestNotificationPermissions();
    if (!granted || generation !== habitReminderSyncGeneration) return;

    const habits = elements.filter(
      (element) => element.kind === 'habit' && !isElementArchived(element),
    );

    for (const element of habits) {
      if (generation !== habitReminderSyncGeneration) return;

      const config = HabitConfigSchema.parse(element.config);
      if (!canScheduleStartReminder(config)) continue;

      await scheduleStartRemindersForHabit(
        Notifications,
        element,
        config,
        habitDoneToday[element.id] ?? false,
      );
    }
  };

  const next = enqueueHabitReminderWork(run);
  await next;
}

/**
 * Schedule the recurring evening check-in.
 * Always schedules when enabled — local DAILY triggers cannot reliably mean
 * "only if unfinished" without cancelling tomorrow's fire. Body uses a live
 * unfinished count when provided (> 0); otherwise a generic prompt.
 */
export async function scheduleEndOfDayReminder(
  enabled: boolean,
  timeHHmm: string = DEFAULT_EVENING_CHECK_IN_TIME,
  unfinishedCount?: number,
): Promise<void> {
  await enqueueHabitReminderWork(async () => {
    if (!isNotificationsNativeAvailable()) {
      return;
    }

    const Notifications = await getNotifications();
    if (!Notifications) return;

    const generation = habitReminderSyncGeneration;
    await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_REMINDER_ID);
    if (generation !== habitReminderSyncGeneration) return;

    if (!enabled) {
      return;
    }

    const granted = await requestNotificationPermissions();
    if (!granted || generation !== habitReminderSyncGeneration) return;

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
      },
    });
  });
}

export async function cancelAllHabitReminders(): Promise<void> {
  await enqueueHabitReminderWork(async () => {
    if (!isNotificationsNativeAvailable()) return;

    const Notifications = await getNotifications();
    if (!Notifications) return;

    habitReminderSyncGeneration += 1;
    await cancelHabitStartRemindersWith(Notifications);
    await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_REMINDER_ID);
  });
}
