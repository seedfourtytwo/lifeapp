import { z } from 'zod';
import { HabitScheduleSchema } from './schedule';

/**
 * What the native reminder scheduler works from: `files/widget/reminders.json`,
 * written by JavaScript whenever it changes. Native arms one alarm for the
 * next moment and judges at that moment, from the widget snapshot and its
 * queue, whether the habit is still to do. `docs/widget-contract.md`
 * ("Reminder plan") is the contract, and must change with this.
 */

export const REMINDER_PLAN_VERSION = 1;

const LocalClockTime = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const ReminderPlanHabitSchema = z.object({
  id: z.string().min(1),
  /** The real name: only in the notification's private version. */
  name: z.string(),
  /** What a locked phone that hides content shows; null keeps it hidden. */
  lockScreenName: z.string().nullable(),
  schedule: HabitScheduleSchema,
  /** Local `HH:mm`, earliest first, once each. */
  reminderTimes: z.array(LocalClockTime).min(1),
});

export const ReminderPlanSchema = z.object({
  version: z.literal(REMINDER_PLAN_VERSION),
  /** The Habit reminders switch is on and notifications are allowed. */
  enabled: z.boolean(),
  /** The app's language; every native notification is worded in it. */
  language: z.enum(['en', 'fr']),
  habits: z.array(ReminderPlanHabitSchema),
});

export type ReminderPlanHabit = z.infer<typeof ReminderPlanHabitSchema>;
export type ReminderPlan = z.infer<typeof ReminderPlanSchema>;
