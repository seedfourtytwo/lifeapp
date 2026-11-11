/**
 * How many notifications each reminder family may keep pending at once.
 *
 * expo-notifications sets one AlarmManager alarm per pending notification,
 * and Android refuses an app more than 500 concurrent alarms (AOSP
 * AlarmManagerService, max_alarms_per_uid, default 500; it throws once that is
 * reached). The shares add up to 266, leaving room for whatever else the app
 * or a future widget sets. A family that would exceed its share schedules
 * fewer days ahead rather than leaving an item out.
 */
export const NOTIFICATION_BUDGET = {
  habitReminders: 200,
  calendarReminders: 64,
  eveningCheckIn: 1,
  habitTimer: 1,
} as const;
