import { lifeCore } from '../core/lifeCore';
import { ReminderPlanSchema, type ReminderPlan } from '../protocol/reminderPlan';
import { replaceWidgetFile, widgetDirectory } from './widgetFiles';

export const REMINDER_PLAN_FILE = 'reminders.json';

/**
 * Replace the reminder plan beside the snapshot, then tell the native
 * scheduler, which arms its alarm for the next moment from it.
 */
export async function writeReminderPlan(plan: ReminderPlan): Promise<void> {
  if (!widgetDirectory()) return;
  await replaceWidgetFile(REMINDER_PLAN_FILE, JSON.stringify(ReminderPlanSchema.parse(plan)));
  await lifeCore.remindersChanged();
}
