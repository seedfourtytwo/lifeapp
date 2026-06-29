import { NativeModules } from 'react-native';
import type { ElementDefinition, HabitConfig } from '../protocol';
import { HabitConfigSchema } from '../protocol';
import { isScheduleSupportedForReminders, toExpoWeekday } from '../protocol/schedule';
import { timeToMinutes } from '../utils/time';

const REMINDER_PREFIX = 'habit-reminder-';
const END_OF_DAY_REMINDER_ID = `${REMINDER_PREFIX}eod`;

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
      'expo-notifications is unavailable; habit reminders disabled until you rebuild the dev client.',
      error,
    );
    return null;
  }
}

function reminderTimeFromRange(
  start: string,
  remindMinutesBefore: number,
): { hour: number; minute: number } {
  const startMinutes = timeToMinutes(start);
  const total = Math.max(0, startMinutes - remindMinutesBefore);
  return {
    hour: Math.floor(total / 60),
    minute: total % 60,
  };
}

function canScheduleStartReminder(config: HabitConfig): boolean {
  return (
    config.timeRange !== undefined &&
    config.remindMinutesBefore !== undefined &&
    config.remindMinutesBefore >= 0 &&
    isScheduleSupportedForReminders(config.schedule)
  );
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

async function scheduleDailyReminder(
  notifications: NotificationsModule,
  element: ElementDefinition,
  config: HabitConfig,
): Promise<void> {
  if (!config.timeRange || config.remindMinutesBefore === undefined) return;

  const { hour, minute } = reminderTimeFromRange(
    config.timeRange.start,
    config.remindMinutesBefore,
  );

  await notifications.scheduleNotificationAsync({
    identifier: `${REMINDER_PREFIX}${element.id}`,
    content: {
      title: 'Habit reminder',
      body: `Time for ${element.name}`,
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

async function scheduleWeekdayReminders(
  notifications: NotificationsModule,
  element: ElementDefinition,
  config: HabitConfig,
): Promise<void> {
  if (!config.timeRange || config.remindMinutesBefore === undefined) return;
  if (config.schedule.type !== 'weekdays') return;

  const { hour, minute } = reminderTimeFromRange(
    config.timeRange.start,
    config.remindMinutesBefore,
  );

  await Promise.all(
    config.schedule.days.map((day) =>
      notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_PREFIX}${element.id}-${day}`,
        content: {
          title: 'Habit reminder',
          body: `Time for ${element.name}`,
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: toExpoWeekday(day),
          hour,
          minute,
        },
      }),
    ),
  );
}

export async function syncHabitReminders(
  elements: ElementDefinition[],
  enabled: boolean,
): Promise<void> {
  if (!enabled || !isNotificationsNativeAvailable()) {
    return;
  }

  const Notifications = await getNotifications();
  if (!Notifications) return;

  await cancelHabitStartRemindersWith(Notifications);

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const habits = elements.filter((element) => element.kind === 'habit');

  for (const element of habits) {
    const config = HabitConfigSchema.parse(element.config);
    if (!canScheduleStartReminder(config)) continue;

    if (config.schedule.type === 'weekdays') {
      await scheduleWeekdayReminders(Notifications, element, config);
    } else {
      await scheduleDailyReminder(Notifications, element, config);
    }
  }
}

export async function scheduleEndOfDayReminder(
  enabled: boolean,
  undoneCount: number,
): Promise<void> {
  if (!enabled || undoneCount <= 0 || !isNotificationsNativeAvailable()) {
    return;
  }

  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_REMINDER_ID);

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: END_OF_DAY_REMINDER_ID,
    content: {
      title: 'Habits left today',
      body: `${undoneCount} habit${undoneCount === 1 ? '' : 's'} still to do`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

export async function cancelAllHabitReminders(): Promise<void> {
  if (!isNotificationsNativeAvailable()) return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  await cancelHabitStartRemindersWith(Notifications);
  await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_REMINDER_ID);
}
