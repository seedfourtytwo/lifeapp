import { i18n } from '../i18n';
import type { ElementDefinition } from '../protocol';
import { HabitConfigSchema } from '../protocol';
import { DEFAULT_EVENING_CHECK_IN_TIME, parseEveningCheckInTime } from '../protocol/appSettings';
import { isElementArchived } from '../utils/dashboardElements';
import {
  collectStartReminderFires,
  fitFiresToBudget,
  type StartReminderFire,
} from './habitStartReminderTimes';
import { NOTIFICATION_BUDGET } from './notificationBudget';
import {
  cancelScheduledWithPrefix,
  getNotifications,
  isNotificationsNativeAvailable,
  reconcileDateReminders,
  requestNotificationPermissions,
  REMINDERS_CHANNEL_ID,
  type NotificationsModule,
} from './notificationsBootstrap.native';

export { isNotificationsNativeAvailable, requestNotificationPermissions };

const REMINDER_PREFIX = 'habit-reminder-';
const END_OF_DAY_REMINDER_ID = `${REMINDER_PREFIX}eod`;
let habitReminderSyncGeneration = 0;
let habitReminderSyncChain: Promise<void> = Promise.resolve();

function enqueueHabitReminderWork(work: () => Promise<void>): Promise<void> {
  const next = habitReminderSyncChain.then(work, work);
  habitReminderSyncChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function parseCheckInHourMinute(timeHHmm: string): { hour: number; minute: number } {
  const parsed = parseEveningCheckInTime(timeHHmm) ?? DEFAULT_EVENING_CHECK_IN_TIME;
  const [hour, minute] = parsed.split(':').map(Number);
  return { hour, minute };
}

async function cancelHabitStartRemindersWith(notifications: NotificationsModule): Promise<void> {
  await cancelScheduledWithPrefix(notifications, REMINDER_PREFIX, {
    keep: (id) => id === END_OF_DAY_REMINDER_ID,
  });
}

export async function cancelHabitStartReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await cancelHabitStartRemindersWith(Notifications);
}

type HabitReminderFire = StartReminderFire & { identifier: string; name: string };

function habitReminderId(elementId: string, fire: StartReminderFire): string {
  return `${REMINDER_PREFIX}${elementId}-${fire.dateStr}-${fire.time.replace(':', '')}`;
}

function collectHabitReminderFires(
  elements: readonly ElementDefinition[],
  habitDoneToday: Record<string, boolean>,
  now: Date,
): HabitReminderFire[] {
  const fires: HabitReminderFire[] = [];
  for (const element of elements) {
    if (element.kind !== 'habit' || isElementArchived(element)) continue;
    const config = HabitConfigSchema.parse(element.config);
    const doneToday = habitDoneToday[element.id] ?? false;
    for (const fire of collectStartReminderFires(config, { now, doneToday })) {
      fires.push({ ...fire, identifier: habitReminderId(element.id, fire), name: element.name });
    }
  }
  return fitFiresToBudget(fires, NOTIFICATION_BUDGET.habitReminders);
}

/**
 * Bring the pending habit reminders in line with the habits. Identifiers are
 * stable (habit, day, time), so a re-sync leaves alone what is already pending
 * as wanted, replaces what changed, and cancels only what no longer belongs: a time removed, a habit archived or
 * deleted, a day already done, or everything when switched off.
 */
export async function syncHabitReminders(
  elements: ElementDefinition[],
  enabled: boolean,
  habitDoneToday: Record<string, boolean> = {},
  now: Date = new Date(),
): Promise<void> {
  const run = async (): Promise<void> => {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    const generation = ++habitReminderSyncGeneration;
    const granted = enabled && (await requestNotificationPermissions());
    if (generation !== habitReminderSyncGeneration) return;

    const fires = granted ? collectHabitReminderFires(elements, habitDoneToday, now) : [];
    await reconcileDateReminders(
      Notifications,
      REMINDER_PREFIX,
      fires.map((fire) => ({
        identifier: fire.identifier,
        title: i18n.t('notifications:habitReminder.title'),
        body: i18n.t('notifications:habitReminder.body', { name: fire.name }),
        when: fire.when,
      })),
      {
        keep: (id) => id === END_OF_DAY_REMINDER_ID,
        stillCurrent: () => generation === habitReminderSyncGeneration,
      },
    );
  };

  await enqueueHabitReminderWork(run);
}

/**
 * Schedule the recurring evening check-in.
 * Always schedules when enabled — local DAILY triggers cannot reliably mean
 * "only if unfinished" without cancelling tomorrow's fire. Body uses a live
 * unfinished count when provided (> 0); otherwise a generic prompt.
 */
export async function scheduleEndOfDayReminder(
  enabled: boolean,
  timeHHmm: string = DEFAULT_EVENING_CHECK_IN_TIME,
  unfinishedCount?: number,
): Promise<void> {
  await enqueueHabitReminderWork(async () => {
    if (!isNotificationsNativeAvailable()) {
      return;
    }

    const Notifications = await getNotifications();
    if (!Notifications) return;

    const generation = habitReminderSyncGeneration;
    await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_REMINDER_ID);
    if (generation !== habitReminderSyncGeneration) return;

    if (!enabled) {
      return;
    }

    const granted = await requestNotificationPermissions();
    if (!granted || generation !== habitReminderSyncGeneration) return;

    const { hour, minute } = parseCheckInHourMinute(timeHHmm);
    const hasCount = unfinishedCount !== undefined && unfinishedCount > 0;

    await Notifications.scheduleNotificationAsync({
      identifier: END_OF_DAY_REMINDER_ID,
      content: {
        title: i18n.t('notifications:eveningCheckIn.title'),
        body: hasCount
          ? i18n.t(
              unfinishedCount === 1
                ? 'notifications:eveningCheckIn.bodyOne'
                : 'notifications:eveningCheckIn.bodyMany',
              { count: unfinishedCount },
            )
          : i18n.t('notifications:eveningCheckIn.bodyGeneric'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  });
}

export async function cancelAllHabitReminders(): Promise<void> {
  await enqueueHabitReminderWork(async () => {
    if (!isNotificationsNativeAvailable()) return;

    const Notifications = await getNotifications();
    if (!Notifications) return;

    habitReminderSyncGeneration += 1;
    await cancelHabitStartRemindersWith(Notifications);
    await Notifications.cancelScheduledNotificationAsync(END_OF_DAY_REMINDER_ID);
  });
}
