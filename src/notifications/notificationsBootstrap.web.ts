import type { NotificationPermission } from './notificationsBootstrap.native';

/** Notifications are not supported on web. */
export function isNotificationsNativeAvailable(): boolean {
  return false;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  return { status: 'unavailable', canAskAgain: false };
}
