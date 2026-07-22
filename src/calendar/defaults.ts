export const DEFAULT_CALENDAR_NAME = 'Personal';
export const DEFAULT_CALENDAR_COLOR = '#3D7EA6';

/**
 * Sensible defaults without forcing an event “type”.
 * Yearly repeat also adds a 2-week heads-up (birthday-friendly) in the editor.
 */
export function defaultReminderOffsets(allDay: boolean): number[] {
  return allDay ? [60 * 24] : [60];
}

/** Extra offset suggested when the user picks yearly repeat. */
export const YEARLY_EXTRA_REMINDER_MINUTES = 60 * 24 * 14;

export const REMINDER_PRESET_OPTIONS: { labelKey: string; offsetMinutes: number }[] = [
  { labelKey: 'reminders.atTimeOfEvent', offsetMinutes: 0 },
  { labelKey: 'reminders.minutesBefore15', offsetMinutes: 15 },
  { labelKey: 'reminders.hourBefore1', offsetMinutes: 60 },
  { labelKey: 'reminders.dayBefore1', offsetMinutes: 60 * 24 },
  { labelKey: 'reminders.daysBefore2', offsetMinutes: 60 * 24 * 2 },
  { labelKey: 'reminders.weekBefore1', offsetMinutes: 60 * 24 * 7 },
  { labelKey: 'reminders.weeksBefore2', offsetMinutes: 60 * 24 * 14 },
];

export const REPEAT_OPTIONS: {
  freq: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  labelKey: string;
}[] = [
  { freq: 'none', labelKey: 'repeatOptions.none' },
  { freq: 'daily', labelKey: 'repeatOptions.daily' },
  { freq: 'weekly', labelKey: 'repeatOptions.weekly' },
  { freq: 'monthly', labelKey: 'repeatOptions.monthly' },
  { freq: 'yearly', labelKey: 'repeatOptions.yearly' },
];
