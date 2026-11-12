/** Notifications are not supported on web. */
export function isNotificationsNativeAvailable(): boolean {
  return false;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function scheduleEndOfDayReminder(
  _enabled: boolean,
  _timeHHmm?: string,
  _unfinishedCount?: number,
): Promise<void> {}

export async function cancelHabitStartReminders(): Promise<void> {}
