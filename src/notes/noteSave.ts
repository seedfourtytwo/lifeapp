import { getDatabase } from '../db/client';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as noteShareRepo from '../db/repositories/noteShareStateRepository';
import { withGuardedWrite } from '../db/dataGeneration';
import { withDbWriteLock } from '../db/writeLock';
import { toJournalChapters, type JournalChapter } from './journalChapters';
import { noteBodyFingerprint } from './noteShareStatus';
import type { NoteEditorTarget } from './types';

export type SavedNote = {
  body: string;
  id: string;
};

/**
 * Share state is keyed per *chapter* for a journal — the notebook is the
 * element, the `daily_journals` row is the entry (see noteShareStateRepository).
 * A day used to get one fingerprint; once the reader can send two chapters out
 * of four, one fingerprint could no longer describe what left.
 */
function trackerShareTarget(elementId: string) {
  return { kind: 'tracker' as const, elementId, entryId: '' };
}

function journalShareTarget(notebookId: string, chapterId: string) {
  return { kind: 'journal' as const, elementId: notebookId, entryId: chapterId };
}

/**
 * Load the body of the one chapter this target names. Empty string when none —
 * including when `entryId` names a chapter the reader just added and has not
 * written into yet.
 */
export async function loadNoteBody(
  target: NoteEditorTarget,
  date: string,
): Promise<string> {
  const db = await getDatabase();
  if (target.kind === 'tracker') {
    const note = await dayNoteRepo.getNote(db, target.elementId, date);
    return note?.body ?? '';
  }
  if (target.entryId) {
    const chapter = await dailyJournalRepo.getJournalById(db, target.entryId);
    return chapter?.body ?? '';
  }
  const first = await dailyJournalRepo.getFirstJournalChapter(db, target.notebookId, date);
  return first?.body ?? '';
}

/** Every chapter of a journal target's day. Empty for a tracker note. */
export async function loadJournalChapters(
  target: NoteEditorTarget,
  date: string,
): Promise<JournalChapter[]> {
  if (target.kind !== 'journal') return [];
  const db = await getDatabase();
  return toJournalChapters(
    await dailyJournalRepo.getJournalChapters(db, target.notebookId, date),
  );
}

/**
 * Persist one chapter. Whitespace-only clears that chapter — and only that one.
 * Returns the saved body+id, or null when cleared.
 */
export async function saveNoteBody(
  target: NoteEditorTarget,
  date: string,
  body: string,
): Promise<SavedNote | null> {
  return withDbWriteLock(async () => {
    const db = await getDatabase();
    if (target.kind === 'tracker') {
      const row = await dayNoteRepo.upsertNote(db, {
        elementId: target.elementId,
        date,
        body,
      });
      if (row == null) {
        await noteShareRepo.deleteShareState(db, trackerShareTarget(target.elementId), date);
        return null;
      }
      return { body: row.body, id: row.id };
    }
    // Which chapter is about to be written, resolved *before* the write: a
    // whitespace-only body deletes the row, and after that there is nothing
    // left to tell us whose fingerprint to forget.
    const chapterId =
      target.entryId ??
      (await dailyJournalRepo.getFirstJournalChapter(db, target.notebookId, date))?.id;
    const row = await dailyJournalRepo.upsertJournal(db, {
      id: target.entryId,
      notebookId: target.notebookId,
      date,
      body,
    });
    if (row == null) {
      if (chapterId) {
        await noteShareRepo.deleteShareState(
          db,
          journalShareTarget(target.notebookId, chapterId),
          date,
        );
      }
      return null;
    }
    return { body: row.body, id: row.id };
  });
}

/**
 * Delete one chapter outright, without going through an empty draft.
 *
 * Guarded rather than merely locked: this is a destructive write, and an
 * import or a Clear data that replaced the journal scope mid-flight would
 * otherwise see this delete land on a row it never wrote.
 */
export async function deleteJournalChapter(
  target: NoteEditorTarget,
  date: string,
): Promise<void> {
  if (target.kind !== 'journal' || !target.entryId) return;
  const { notebookId, entryId } = target;
  await withGuardedWrite('journal', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return;
    await dailyJournalRepo.deleteJournal(db, entryId);
    if (superseded()) return;
    // The fingerprint belonged to this chapter alone, so it goes with it —
    // the day's other chapters keep theirs and stay "shared".
    await noteShareRepo.deleteShareState(
      db,
      journalShareTarget(notebookId, entryId),
      date,
    );
  });
}

/** Last shared fingerprint for a tracker day note. Journals go per chapter. */
export async function loadNoteShareFingerprint(
  target: NoteEditorTarget,
  date: string,
): Promise<string | null> {
  if (target.kind !== 'tracker') return null;
  const db = await getDatabase();
  return noteShareRepo.getShareFingerprint(db, trackerShareTarget(target.elementId), date);
}

/** Last shared fingerprint of every chapter of a notebook day, by chapter id. */
export async function loadJournalChapterShareFingerprints(
  target: NoteEditorTarget,
  date: string,
): Promise<Record<string, string>> {
  if (target.kind !== 'journal' || !target.notebookId) return {};
  const db = await getDatabase();
  return noteShareRepo.getJournalDayShareFingerprints(db, target.notebookId, date);
}

/** Record that `body` was handed to the system share sheet. */
export async function markNoteShared(
  target: NoteEditorTarget,
  date: string,
  body: string,
): Promise<string> {
  if (target.kind !== 'tracker') {
    throw new Error('Journal chapters record their share state per chapter');
  }
  const fingerprint = noteBodyFingerprint(body);
  const elementId = target.elementId;
  return withDbWriteLock(async () => {
    const db = await getDatabase();
    await noteShareRepo.upsertShareState(db, trackerShareTarget(elementId), date, fingerprint);
    return fingerprint;
  });
}

/**
 * Record which chapters just went out, and what each of them said.
 *
 * One fingerprint per chapter, taken from the same bodies that were joined
 * into the file — so the two can only ever agree. Guarded rather than merely
 * locked: an import or a Clear data that replaced the journal scope mid-share
 * would otherwise leave fingerprints pointing at rows it never wrote.
 */
export async function markJournalChaptersShared(
  notebookId: string,
  date: string,
  chapters: readonly { id: string; body: string }[],
): Promise<Record<string, string>> {
  const marked: Record<string, string> = {};
  for (const chapter of chapters) marked[chapter.id] = noteBodyFingerprint(chapter.body);
  const wrote = await withGuardedWrite('journal', async ({ superseded }) => {
    const db = await getDatabase();
    if (superseded()) return false;
    await noteShareRepo.upsertJournalChapterShareState(
      db,
      notebookId,
      date,
      chapters.map((chapter) => ({ chapterId: chapter.id, bodyFp: marked[chapter.id]! })),
    );
    return true;
  });
  // Nothing recorded, nothing to colour green: an import replaced the journal
  // mid-share, and the rows these fingerprints describe are no longer there.
  return wrote === true ? marked : {};
}
