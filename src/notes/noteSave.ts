import { getDatabase } from '../db/client';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as noteShareRepo from '../db/repositories/noteShareStateRepository';
import { withDbWriteLock } from '../db/writeLock';
import { noteBodyFingerprint } from './noteShareStatus';
import type { NoteEditorTarget } from './types';

function shareTarget(target: NoteEditorTarget) {
  if (target.kind === 'tracker') {
    return { kind: 'tracker' as const, elementId: target.elementId };
  }
  return { kind: 'journal' as const, elementId: '' };
}

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
    let savedBody: string | null;
    if (target.kind === 'tracker') {
      const saved = await dayNoteRepo.upsertNote(db, {
        elementId: target.elementId,
        date,
        body,
      });
      savedBody = saved?.body ?? null;
    } else {
      const saved = await dailyJournalRepo.upsertJournal(db, { date, body });
      savedBody = saved?.body ?? null;
    }
    if (savedBody == null) {
      await noteShareRepo.deleteShareState(db, shareTarget(target), date);
    }
    return savedBody;
  });
}

export async function loadNoteShareFingerprint(
  target: NoteEditorTarget,
  date: string,
): Promise<string | null> {
  const db = await getDatabase();
  return noteShareRepo.getShareFingerprint(db, shareTarget(target), date);
}

/** Record that `body` was handed to the system share sheet. */
export async function markNoteShared(
  target: NoteEditorTarget,
  date: string,
  body: string,
): Promise<string> {
  const fingerprint = noteBodyFingerprint(body);
  return withDbWriteLock(async () => {
    const db = await getDatabase();
    await noteShareRepo.upsertShareState(db, shareTarget(target), date, fingerprint);
    return fingerprint;
  });
}
