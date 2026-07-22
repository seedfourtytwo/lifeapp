import { getDatabase } from '../db/client';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import { withDbWriteLock } from '../db/writeLock';
import type { NoteEditorTarget } from './types';

/** Load note body for a target+date. Empty string when none. */
export async function loadNoteBody(
  target: NoteEditorTarget,
  date: string,
): Promise<string> {
  const db = await getDatabase();
  if (target.kind === 'tracker') {
    const note = await dayNoteRepo.getNote(db, target.elementId, date);
    return note?.body ?? '';
  }
  const journal = await dailyJournalRepo.getJournal(db, date);
  return journal?.body ?? '';
}

/**
 * Persist note body. Whitespace-only clears the row.
 * Returns the trimmed body, or null when cleared.
 */
export async function saveNoteBody(
  target: NoteEditorTarget,
  date: string,
  body: string,
): Promise<string | null> {
  return withDbWriteLock(async () => {
    const db = await getDatabase();
    if (target.kind === 'tracker') {
      const saved = await dayNoteRepo.upsertNote(db, {
        elementId: target.elementId,
        date,
        body,
      });
      return saved?.body ?? null;
    }
    const saved = await dailyJournalRepo.upsertJournal(db, { date, body });
    return saved?.body ?? null;
  });
}
