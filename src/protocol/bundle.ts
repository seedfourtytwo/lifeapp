import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { AppSettingsSchema } from './appSettings';
import { ElementDefinitionSchema } from './element';
import { EventSchema } from './event';
import { DayNoteSchema, validateBundleDayNoteLinks, type DayNote } from './dayNote';
import { DailyJournalSchema, validateBundleDailyJournals, type DailyJournal } from './dailyJournal';
import { validateBundleEventLinks } from './eventMeta';
import { CalendarBackupSchema, type CalendarBackup } from '../calendar/types';
import type { AppSettings } from './appSettings';
import type { ElementDefinition } from './element';
import type { LifeEvent } from './event';

export { AppSettingsSchema } from './appSettings';
export type { AppSettings } from './appSettings';

export const DashboardItemSchema = z.object({
  id: z.string().uuid(),
  elementId: z.string().uuid(),
  sortOrder: z.number().int(),
});

export type DashboardItem = z.infer<typeof DashboardItemSchema>;

export const ProtocolBundleSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  exportedAt: z.string().datetime(),
  elements: z.array(ElementDefinitionSchema),
  dashboard: z.array(DashboardItemSchema),
  events: z.array(EventSchema),
  /** Per-tracker per-day notes — optional for older backups. */
  dayNotes: z.array(DayNoteSchema).optional(),
  /** Whole-day journals — optional for older backups. */
  dailyJournals: z.array(DailyJournalSchema).optional(),
  settings: AppSettingsSchema.optional(),
  /** Ambient calendar data — optional for older backups. */
  calendar: CalendarBackupSchema.optional(),
});

export type ProtocolBundle = z.infer<typeof ProtocolBundleSchema>;

export function parseProtocolBundle(raw: unknown): ProtocolBundle {
  const bundle = ProtocolBundleSchema.parse(raw);
  validateBundleEventLinks(bundle.elements, bundle.events);
  if (bundle.dayNotes) {
    validateBundleDayNoteLinks(bundle.elements, bundle.dayNotes);
  }
  if (bundle.dailyJournals) {
    validateBundleDailyJournals(bundle.dailyJournals);
  }
  return bundle;
}

export function createProtocolBundle(input: {
  elements: ElementDefinition[];
  dashboard: z.infer<typeof DashboardItemSchema>[];
  events: LifeEvent[];
  dayNotes?: DayNote[];
  dailyJournals?: DailyJournal[];
  settings?: AppSettings;
  calendar?: CalendarBackup;
}): ProtocolBundle {
  const bundle: ProtocolBundle = {
    protocolVersion: PROTOCOL_VERSION,
    exportedAt: new Date().toISOString(),
    elements: input.elements,
    dashboard: input.dashboard,
    events: input.events,
    ...(input.dayNotes && input.dayNotes.length > 0 ? { dayNotes: input.dayNotes } : {}),
    ...(input.dailyJournals && input.dailyJournals.length > 0
      ? { dailyJournals: input.dailyJournals }
      : {}),
    ...(input.settings ? { settings: input.settings } : {}),
    ...(input.calendar ? { calendar: input.calendar } : {}),
  };
  validateBundleEventLinks(bundle.elements, bundle.events);
  if (bundle.dayNotes) {
    validateBundleDayNoteLinks(bundle.elements, bundle.dayNotes);
  }
  if (bundle.dailyJournals) {
    validateBundleDailyJournals(bundle.dailyJournals);
  }
  return bundle;
}
