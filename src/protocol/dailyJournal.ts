import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { DAY_NOTE_BODY_MAX_LENGTH } from './dayNote';
import type { JournalNotebook } from './journalNotebook';

/** Absolute max — shared with tracker day notes. */
export const DAILY_JOURNAL_BODY_MAX_LENGTH = DAY_NOTE_BODY_MAX_LENGTH;

/**
 * One chapter of a notebook's day, stamped with a calendar day.
 *
 * A (notebook, date) holds *several* of these — the day's chapters, in
 * `sortOrder`. Up to schema v21 the app enforced exactly one row per notebook
 * day and merged anything else away; v22 dropped that constraint, because a day
 * with a morning entry and an evening entry is two pieces of writing, not one
 * document that happened to be saved twice.
 *
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
  /**
   * Position of this chapter within its notebook day, 0-based.
   *
   * Defaults rather than being required: every backup written before v22 lacks
   * the field entirely, and a whole restore failing over a missing ordinal
   * would be the worst possible trade. The default is only the floor — bundle
   * import numbers a day's chapters deterministically first
   * (`normalizeProtocolBundle.ts`), so this fires only for a bundle parsed
   * outside that path.
   */
  sortOrder: z.number().int().min(0).default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type DailyJournal = z.infer<typeof DailyJournalSchema>;

/** Join a notebook day's chapters into the one text that gets copied or shared. */
export function joinJournalDayBodies(bodies: string[]): string {
  const joined = bodies
    .map((body) => body.trimEnd())
    .filter((body) => body.trim().length > 0)
    .join('\n\n');
  if (joined.length <= DAILY_JOURNAL_BODY_MAX_LENGTH) return joined;
  return joined.slice(0, DAILY_JOURNAL_BODY_MAX_LENGTH).trimEnd();
}

/**
 * Bundle-level checks for journals.
 *
 * Several rows for one notebook day used to be an error here: the app kept one
 * document per day, so a second row could only be corruption. Since v22 it is
 * the normal shape of a day with more than one chapter, and rejecting it would
 * refuse every backup taken after this release. What stays rejected is a
 * genuine contradiction — one id used twice, or a chapter filed under a
 * notebook the bundle does not carry.
 */
export function validateBundleDailyJournals(
  journals: DailyJournal[],
  notebooks?: JournalNotebook[],
): void {
  const seenIds = new Set<string>();
  const notebookIds = notebooks ? new Set(notebooks.map((notebook) => notebook.id)) : null;

  for (const journal of journals) {
    if (seenIds.has(journal.id)) {
      throw new Error(`Duplicate daily journal ${journal.id}`);
    }
    seenIds.add(journal.id);
    if (notebookIds && !notebookIds.has(journal.notebookId)) {
      throw new Error(
        `Daily journal ${journal.id} references unknown notebook ${journal.notebookId}`,
      );
    }
  }
}
