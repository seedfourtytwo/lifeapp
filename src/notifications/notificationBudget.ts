/**
 * How many notifications each reminder family may keep pending at once.
 * Together they stay well under the ~60 the platforms tolerate (iOS keeps 64;
 * Android has no small cap, but every pending one is an alarm and a stored
 * request). A family that would exceed its share schedules less far ahead.
 */
export const NOTIFICATION_BUDGET = {
  habitReminders: 36,
  calendarReminders: 12,
  eveningCheckIn: 1,
  habitTimer: 1,
} as const;
