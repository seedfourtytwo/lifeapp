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

export const REMINDER_PRESET_OPTIONS: { label: string; offsetMinutes: number }[] = [
  { label: 'At time of event', offsetMinutes: 0 },
  { label: '15 minutes before', offsetMinutes: 15 },
  { label: '1 hour before', offsetMinutes: 60 },
  { label: '1 day before', offsetMinutes: 60 * 24 },
  { label: '2 days before', offsetMinutes: 60 * 24 * 2 },
  { label: '1 week before', offsetMinutes: 60 * 24 * 7 },
  { label: '2 weeks before', offsetMinutes: 60 * 24 * 14 },
];

export const REPEAT_OPTIONS: {
  freq: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  label: string;
}[] = [
  { freq: 'none', label: 'Does not repeat' },
  { freq: 'daily', label: 'Every day' },
  { freq: 'weekly', label: 'Every week' },
  { freq: 'monthly', label: 'Every month' },
  { freq: 'yearly', label: 'Every year' },
];
