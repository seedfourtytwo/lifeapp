import { requireOptionalNativeModule } from 'expo-modules-core';
import { i18n } from '../i18n';

/**
 * The one way into expo-notifications for every reminder module: the
 * availability check, the lazy import with its foreground handler, the
 * permission prompt, and cancelling a family of reminders by prefix.
 */

export type NotificationsModule = typeof import('expo-notifications');

/** Android channel every reminder is posted on. */
export const REMINDERS_CHANNEL_ID = 'reminders';

let notificationsModule: NotificationsModule | null = null;
let notificationsUnavailable = false;

/**
 * Avoid importing expo-notifications when its native side is missing (old dev client).
 * Expo modules are not on React Native's `NativeModules` under the new architecture,
 * so ask the Expo registry for the scheduler module that local reminders go through.
 */
export function isNotificationsNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoNotificationScheduler') != null;
}

export async function getNotifications(): Promise<NotificationsModule | null> {
  if (notificationsUnavailable || !isNotificationsNativeAvailable()) {
    notificationsUnavailable = true;
    return null;
  }
  if (notificationsModule) return notificationsModule;

  try {
    const loaded = await import('expo-notifications');
    loaded.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    // Android 13+ only shows the permission prompt once a channel exists, and a
    // notification naming a missing channel is dropped — so this comes first.
    // Re-setting an existing channel only updates its name; importance stays
    // whatever the user last chose in system settings.
    await loaded.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
      name: i18n.t('notifications:channel.remindersName'),
      importance: loaded.AndroidImportance.HIGH,
    });
    notificationsModule = loaded;
    return loaded;
  } catch (error) {
    notificationsUnavailable = true;
    console.warn(
      'expo-notifications is unavailable; reminders disabled until you rebuild the dev client.',
      error,
    );
    return null;
  }
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

export async function cancelScheduledWithPrefix(
  notifications: NotificationsModule,
  prefix: string,
  options: { keep?: (identifier: string) => boolean } = {},
): Promise<void> {
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const ids = scheduled
    .map((item) => item.identifier)
    .filter((id) => id.startsWith(prefix) && !options.keep?.(id));
  await Promise.all(ids.map((id) => notifications.cancelScheduledNotificationAsync(id)));
}
