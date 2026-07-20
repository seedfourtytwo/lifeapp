import { z } from 'zod';

export const CALENDAR_SOURCES = ['local'] as const;
export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

/** Stored on events for backup/ICS later; create UI always uses `general` in v1. */
export const CALENDAR_EVENT_TYPES = ['general', 'birthday', 'appointment'] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export const RECURRENCE_FREQS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const CalendarSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  source: z.enum(CALENDAR_SOURCES),
});

export type Calendar = z.infer<typeof CalendarSchema>;

export const CalendarEventSchema = z
  .object({
    id: z.string().uuid(),
    calendarId: z.string().uuid(),
    uid: z.string().min(1),
    title: z.string().min(1).max(200),
    notes: z.string().max(4000).nullable(),
    eventType: z.enum(CALENDAR_EVENT_TYPES),
    allDay: z.boolean(),
    /** All-day: YYYY-MM-DD. Timed: ISO datetime with offset. */
    startAt: z.string().min(1),
    /** All-day: inclusive end date YYYY-MM-DD. Timed: ISO datetime with offset. */
    endAt: z.string().min(1),
    timezone: z.string().min(1),
    /** RFC 5545 RRULE body without "RRULE:" prefix, or null for one-off. */
    rrule: z.string().nullable(),
  })
  .superRefine((event, ctx) => {
    if (event.allDay) {
      if (!DateOnlySchema.safeParse(event.startAt).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'All-day startAt must be YYYY-MM-DD',
          path: ['startAt'],
        });
      }
      if (!DateOnlySchema.safeParse(event.endAt).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'All-day endAt must be YYYY-MM-DD',
          path: ['endAt'],
        });
      }
      if (event.endAt < event.startAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'All-day endAt must be on or after startAt',
          path: ['endAt'],
        });
      }
      return;
    }

    if (!IsoDateTimeSchema.safeParse(event.startAt).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Timed startAt must be ISO datetime with offset',
        path: ['startAt'],
      });
    }
    if (!IsoDateTimeSchema.safeParse(event.endAt).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Timed endAt must be ISO datetime with offset',
        path: ['endAt'],
      });
    }
    if (event.endAt <= event.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Timed endAt must be after startAt',
        path: ['endAt'],
      });
    }
  });

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarReminderSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  /** Minutes before event start (positive). 0 = at start. */
  offsetMinutes: z.number().int().min(0).max(60 * 24 * 365),
  enabled: z.boolean(),
});

export type CalendarReminder = z.infer<typeof CalendarReminderSchema>;

/** One cleared (silenced) occurrence — does not delete the event or future repeats. */
export const CalendarOccurrenceClearSchema = z.object({
  occurrenceKey: z.string().min(1),
  eventId: z.string().uuid(),
  clearedAt: z.string().datetime(),
});

export type CalendarOccurrenceClear = z.infer<typeof CalendarOccurrenceClearSchema>;

export const CALENDAR_BACKUP_VERSION = 1 as const;

export const CalendarBackupSchema = z.object({
  schemaVersion: z.literal(CALENDAR_BACKUP_VERSION),
  calendars: z.array(CalendarSchema),
  events: z.array(CalendarEventSchema),
  reminders: z.array(CalendarReminderSchema),
  /** Optional for older backups. */
  clearedOccurrences: z.array(CalendarOccurrenceClearSchema).optional(),
});

export type CalendarBackup = z.infer<typeof CalendarBackupSchema>;

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
  /** Weekly only — empty means use start weekday. */
  byWeekDays: Weekday[];
}

export interface CalendarOccurrence {
  eventId: string;
  calendarId: string;
  title: string;
  notes: string | null;
  eventType: CalendarEventType;
  allDay: boolean;
  /** Inclusive local start. */
  start: Date;
  /** Exclusive local end for all-day multi-day; exclusive timed end. */
  end: Date;
  /** Stable key for notifications / list keys: eventId + occurrence start. */
  occurrenceKey: string;
  color: string;
  rrule: string | null;
}

/** Drop silenced occurrences from attention surfaces (badge, peek, notifications). */
export function withoutClearedOccurrences(
  occurrences: CalendarOccurrence[],
  clearedKeys: ReadonlySet<string>,
): CalendarOccurrence[] {
  if (clearedKeys.size === 0) return occurrences;
  return occurrences.filter((occ) => !clearedKeys.has(occ.occurrenceKey));
}
