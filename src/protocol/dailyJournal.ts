import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { DAY_NOTE_BODY_MAX_LENGTH } from './dayNote';
import type { JournalNotebook } from './journalNotebook';

/** Absolute max — shared with tracker day notes. */
export const DAILY_JOURNAL_BODY_MAX_LENGTH = DAY_NOTE_BODY_MAX_LENGTH;

/**
 * One journal entry in a notebook, stamped with a calendar day.
 * App invariant: one document per (notebook, date). Capture appends to that file.
 * Older backups may still list several rows for the same day — import merges them.
 * Mutable upsert/delete — same mutability model as DayNote.
 */
export const DailyJournalSchema = z.object({
  id: z.string().uuid(),
  notebookId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z
    .string()
    .min(1)
    .max(DAILY_JOURNAL_BODY_MAX_LENGTH)
    .refine((value) => value.trim().length >= 1, {
      message: 'Journal body cannot be only whitespace',
    }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type DailyJournal = z.infer<typeof DailyJournalSchema>;

/** Join same-day fragments into one notebook document. */
export function joinJournalDayBodies(bodies: string[]): string {
  const joined = bodies
    .map((body) => body.trimEnd())
    .filter((body) => body.trim().length > 0)
    .join('\n\n');
  if (joined.length <= DAILY_JOURNAL_BODY_MAX_LENGTH) return joined;
  return joined.slice(0, DAILY_JOURNAL_BODY_MAX_LENGTH).trimEnd();
}

export function validateBundleDailyJournals(
  journals: DailyJournal[],
  notebooks?: JournalNotebook[],
): void {
  const seenIds = new Set<string>();
  const seenNotebookDays = new Set<string>();
  const notebookIds = notebooks ? new Set(notebooks.map((notebook) => notebook.id)) : null;

  for (const journal of journals) {
    if (seenIds.has(journal.id)) {
      throw new Error(`Duplicate daily journal ${journal.id}`);
    }
    seenIds.add(journal.id);
    const notebookDay = `${journal.notebookId}:${journal.date}`;
    if (seenNotebookDays.has(notebookDay)) {
      throw new Error(
        `Duplicate daily journal for notebook ${journal.notebookId} on ${journal.date}`,
      );
    }
    seenNotebookDays.add(notebookDay);
    if (notebookIds && !notebookIds.has(journal.notebookId)) {
      throw new Error(
        `Daily journal ${journal.id} references unknown notebook ${journal.notebookId}`,
      );
    }
  }
}
