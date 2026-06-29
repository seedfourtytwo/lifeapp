import type { ElementDefinition } from '../protocol';

/** Notifications are not supported on web. */
export function isNotificationsNativeAvailable(): boolean {
  return false;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function syncHabitReminders(
  _elements: ElementDefinition[],
  _enabled: boolean,
): Promise<void> {}

export async function scheduleEndOfDayReminder(
  _enabled: boolean,
  _undoneCount: number,
): Promise<void> {}

export async function cancelAllHabitReminders(): Promise<void> {}

export async function cancelHabitStartReminders(): Promise<void> {}
