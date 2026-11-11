import { i18n } from '../i18n';
import { expandOccurrences } from '../calendar/occurrences';
import type { Calendar, CalendarEvent, CalendarReminder } from '../calendar/types';
import {
  cancelScheduledWithPrefix,
  getNotifications,
  isNotificationsNativeAvailable,
  reconcileDateReminders,
  requestNotificationPermissions,
  type DateReminder,
  type NotificationsModule,
} from './notificationsBootstrap.native';
import { NOTIFICATION_BUDGET } from './notificationBudget';

export { isNotificationsNativeAvailable };

/**
 * Schedule/cancel local DATE notifications for calendar reminders.
 * Invoked only from `useCalendarReminderSync` — do not call from the store.
 */

const REMINDER_PREFIX = 'cal-reminder-';
/** Schedule fire times within this horizon (ms). */
const SCHEDULE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;
/** Bumped on each sync so overlapping runs don't restore stale schedules. */
let reminderSyncGeneration = 0;
/** Serialize syncs — concurrent callers await the latest chain. */
let reminderSyncChain: Promise<void> = Promise.resolve();

async function cancelCalendarRemindersWith(notifications: NotificationsModule): Promise<void> {
  await cancelScheduledWithPrefix(notifications, REMINDER_PREFIX);
}

export async function cancelCalendarReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await cancelCalendarRemindersWith(Notifications);
}

function reminderBody(title: string, offsetMinutes: number): string {
  if (offsetMinutes === 0) return i18n.t('notifications:calendarReminder.atStart', { title });
  if (offsetMinutes < 60) {
    return i18n.t('notifications:calendarReminder.inMinutes', { title, count: offsetMinutes });
  }
  if (offsetMinutes < 60 * 24) {
    const hours = Math.round(offsetMinutes / 60);
    return i18n.t(
      hours === 1
        ? 'notifications:calendarReminder.inHoursOne'
        : 'notifications:calendarReminder.inHoursMany',
      { title, count: hours },
    );
  }
  const days = Math.round(offsetMinutes / (60 * 24));
  return i18n.t(
    days === 1
      ? 'notifications:calendarReminder.inDaysOne'
      : 'notifications:calendarReminder.inDaysMany',
    { title, count: days },
  );
}

type CalendarReminderInput = {
  events: CalendarEvent[];
  calendars: Calendar[];
  reminders: CalendarReminder[];
  clearedOccurrenceKeys?: ReadonlySet<string>;
};

/** The earliest reminders within the horizon and the calendar's share; none without permission. */
async function wantedCalendarReminders(input: CalendarReminderInput): Promise<DateReminder[]> {
  const enabledReminders = input.reminders.filter((r) => r.enabled);
  if (enabledReminders.length === 0 || input.events.length === 0) return [];
  if (!(await requestNotificationPermissions())) return [];

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

  const fires: DateReminder[] = [];
  for (const occ of occurrences) {
    const reminders = remindersByEvent.get(occ.eventId);
    if (!reminders) continue;
    for (const reminder of reminders) {
      const when = new Date(occ.start.getTime() - reminder.offsetMinutes * 60_000);
      if (when.getTime() <= now) continue;
      if (when.getTime() > now + SCHEDULE_HORIZON_MS) continue;
      fires.push({
        identifier: `${REMINDER_PREFIX}${occ.occurrenceKey}-${reminder.offsetMinutes}`,
        title: i18n.t('notifications:calendarReminder.title'),
        body: reminderBody(occ.title, reminder.offsetMinutes),
        when,
      });
    }
  }

  fires.sort((a, b) => a.when.getTime() - b.when.getTime());
  return fires.slice(0, NOTIFICATION_BUDGET.calendarReminders);
}

export async function syncCalendarReminders(input: CalendarReminderInput): Promise<void> {
  const run = async (): Promise<void> => {
    if (!isNotificationsNativeAvailable()) return;

    const Notifications = await getNotifications();
    if (!Notifications) return;

    const generation = ++reminderSyncGeneration;
    const fires = await wantedCalendarReminders(input);
    if (generation !== reminderSyncGeneration) return;
    await reconcileDateReminders(Notifications, REMINDER_PREFIX, fires, {
      stillCurrent: () => generation === reminderSyncGeneration,
    });
  };

  const next = reminderSyncChain.then(run, run);
  reminderSyncChain = next.then(
    () => undefined,
    () => undefined,
  );
  await next;
}
