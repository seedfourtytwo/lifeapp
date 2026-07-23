import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { DAY_NOTE_BODY_MAX_LENGTH } from './dayNote';

/** Absolute max — shared with tracker day notes. */
export const DAILY_JOURNAL_BODY_MAX_LENGTH = DAY_NOTE_BODY_MAX_LENGTH;

/**
 * One general journal entry for a calendar day (not tied to a tracker).
 * Mutable upsert/delete — same mutability model as DayNote.
 */
export const DailyJournalSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z
    .string()
    .min(1)
    .max(DAILY_JOURNAL_BODY_MAX_LENGTH)
    .refine((value) => value.trim().length >= 1, {
      message: 'Journal body cannot be only whitespace',
    }),
  updatedAt: z.string().datetime(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type DailyJournal = z.infer<typeof DailyJournalSchema>;

export function validateBundleDailyJournals(journals: DailyJournal[]): void {
  const seenDates = new Set<string>();
  for (const journal of journals) {
    if (seenDates.has(journal.date)) {
      throw new Error(`Duplicate daily journal for ${journal.date}`);
    }
    seenDates.add(journal.date);
  }
}
