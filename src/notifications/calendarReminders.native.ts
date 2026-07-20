import { NativeModules } from 'react-native';
import { expandOccurrences } from '../calendar/occurrences';
import type { Calendar, CalendarEvent, CalendarReminder } from '../calendar/types';
import {
  isNotificationsNativeAvailable as habitNotificationsAvailable,
  requestNotificationPermissions,
} from './habitReminders.native';

/**
 * Schedule/cancel local DATE notifications for calendar reminders.
 * Invoked only from `useCalendarReminderSync` — do not call from the store.
 */

const REMINDER_PREFIX = 'cal-reminder-';
/** Schedule fire times within this horizon (ms). */
const SCHEDULE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;
/** Cap scheduled notifications to stay under OS limits. */
const MAX_SCHEDULED = 64;

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
let notificationsUnavailable = false;

export function isNotificationsNativeAvailable(): boolean {
  return habitNotificationsAvailable();
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (notificationsUnavailable || !isNotificationsNativeAvailable()) {
    notificationsUnavailable = true;
    return null;
  }
  if (notificationsModule) return notificationsModule;

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
      'expo-notifications is unavailable; calendar reminders disabled until you rebuild the dev client.',
      error,
    );
    return null;
  }
}

async function cancelCalendarRemindersWith(notifications: NotificationsModule): Promise<void> {
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const ids = scheduled
    .map((item) => item.identifier)
    .filter((id) => id.startsWith(REMINDER_PREFIX));
  await Promise.all(ids.map((id) => notifications.cancelScheduledNotificationAsync(id)));
}

export async function cancelCalendarReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await cancelCalendarRemindersWith(Notifications);
}

function reminderBody(title: string, offsetMinutes: number): string {
  if (offsetMinutes === 0) return title;
  if (offsetMinutes < 60) return `${title} in ${offsetMinutes} min`;
  if (offsetMinutes < 60 * 24) {
    const hours = Math.round(offsetMinutes / 60);
    return `${title} in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(offsetMinutes / (60 * 24));
  return `${title} in ${days} day${days === 1 ? '' : 's'}`;
}

export async function syncCalendarReminders(input: {
  events: CalendarEvent[];
  calendars: Calendar[];
  reminders: CalendarReminder[];
  clearedOccurrenceKeys?: ReadonlySet<string>;
}): Promise<void> {
  if (!NativeModules.ExpoPushTokenManager) return;

  const Notifications = await getNotifications();
  if (!Notifications) return;

  await cancelCalendarRemindersWith(Notifications);

  const enabledReminders = input.reminders.filter((r) => r.enabled);
  if (enabledReminders.length === 0 || input.events.length === 0) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const now = Date.now();
  const rangeStart = new Date(now - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now + SCHEDULE_HORIZON_MS);
  const calendarsById = new Map(input.calendars.map((c) => [c.id, c]));
  const cleared = input.clearedOccurrenceKeys ?? new Set<string>();
  const occurrences = expandOccurrences(input.events, calendarsById, rangeStart, rangeEnd).filter(
    (occ) => !cleared.has(occ.occurrenceKey),
  );

  const remindersByEvent = new Map<string, CalendarReminder[]>();
  for (const reminder of enabledReminders) {
    const list = remindersByEvent.get(reminder.eventId) ?? [];
    list.push(reminder);
    remindersByEvent.set(reminder.eventId, list);
  }

  type Fire = { id: string; title: string; body: string; when: Date };
  const fires: Fire[] = [];

  for (const occ of occurrences) {
    const reminders = remindersByEvent.get(occ.eventId);
    if (!reminders) continue;
    for (const reminder of reminders) {
      const when = new Date(occ.start.getTime() - reminder.offsetMinutes * 60_000);
      if (when.getTime() <= now) continue;
      if (when.getTime() > now + SCHEDULE_HORIZON_MS) continue;
      fires.push({
        id: `${REMINDER_PREFIX}${occ.occurrenceKey}-${reminder.offsetMinutes}`,
        title: 'Calendar',
        body: reminderBody(occ.title, reminder.offsetMinutes),
        when,
      });
    }
  }

  fires.sort((a, b) => a.when.getTime() - b.when.getTime());
  const toSchedule = fires.slice(0, MAX_SCHEDULED);

  for (const fire of toSchedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: fire.id,
      content: {
        title: fire.title,
        body: fire.body,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fire.when,
      },
    });
  }
}
