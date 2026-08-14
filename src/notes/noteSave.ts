import { getDatabase } from '../db/client';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as noteShareRepo from '../db/repositories/noteShareStateRepository';
import { withDbWriteLock } from '../db/writeLock';
import { noteBodyFingerprint } from './noteShareStatus';
import type { NoteEditorTarget } from './types';

export type SavedNote = {
  body: string;
  id: string;
};

function shareTarget(target: NoteEditorTarget) {
  if (target.kind === 'tracker') {
    return { kind: 'tracker' as const, elementId: target.elementId, entryId: '' };
  }
  return { kind: 'journal' as const, elementId: '', entryId: target.notebookId };
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
  const journal = await dailyJournalRepo.getJournalForNotebookOnDate(
    db,
    target.notebookId,
    date,
  );
  return journal?.body ?? '';
}

/**
 * Persist note body. Whitespace-only clears the row.
 * Returns the saved body+id, or null when cleared.
 */
export async function saveNoteBody(
  target: NoteEditorTarget,
  date: string,
  body: string,
): Promise<SavedNote | null> {
  return withDbWriteLock(async () => {
    const db = await getDatabase();
    let saved: SavedNote | null;
    if (target.kind === 'tracker') {
      const row = await dayNoteRepo.upsertNote(db, {
        elementId: target.elementId,
        date,
        body,
      });
      saved = row ? { body: row.body, id: row.id } : null;
    } else {
      const row = await dailyJournalRepo.upsertJournal(db, {
        id: target.entryId,
        notebookId: target.notebookId,
        date,
        body,
      });
      saved = row ? { body: row.body, id: row.id } : null;
    }
    if (saved == null) {
      await noteShareRepo.deleteShareState(db, shareTarget(target), date);
    }
    return saved;
  });
}

export async function loadNoteShareFingerprint(
  target: NoteEditorTarget,
  date: string,
): Promise<string | null> {
  if (target.kind === 'journal' && !target.notebookId) return null;
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
