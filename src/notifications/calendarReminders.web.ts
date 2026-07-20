export async function syncCalendarReminders(_input: {
  events: unknown[];
  calendars: unknown[];
  reminders: unknown[];
  clearedOccurrenceKeys?: ReadonlySet<string>;
}): Promise<void> {
  // Web / no native module — calendar reminders are local notifications only.
}

export async function cancelCalendarReminders(): Promise<void> {}

export function isNotificationsNativeAvailable(): boolean {
  return false;
}
