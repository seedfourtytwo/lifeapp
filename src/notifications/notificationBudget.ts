/**
 * How many notifications each reminder family may keep pending at once.
 *
 * expo-notifications sets one AlarmManager alarm per pending notification,
 * and Android refuses an app more than 500 concurrent alarms (AOSP
 * AlarmManagerService, max_alarms_per_uid, default 500; it throws once that is
 * reached). Habit reminders are not here: the native scheduler keeps one
 * alarm for all of them. A family that would exceed its share schedules
 * fewer reminders rather than failing.
 */
export const NOTIFICATION_BUDGET = {
  calendarReminders: 64,
  eveningCheckIn: 1,
  habitTimer: 1,
} as const;
