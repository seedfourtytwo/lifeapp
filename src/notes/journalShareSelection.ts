import { joinJournalDayBodies } from '../protocol';
import type { JournalChapter } from './journalChapters';
import type { NoteSharePart } from './noteShareFileName';

/**
 * Choosing which chapters of a day leave the journal.
 *
 * A notebook day is several pieces of writing, and sending all of them because
 * they happen to share a date is the wrong default for the one entry you
 * actually meant to hand someone. So share and copy both go through a picked
 * subset — defaulting to the whole day, which is what they did before.
 *
 * Everything here is pure and joins with `joinJournalDayBodies`, so there is
 * still exactly one answer to "what separates two chapters", whether one
 * chapter goes out or four.
 */

/**
 * Stand-in id for the chapter being written on an empty day, before its row
 * exists. Real ids are UUIDs, so this cannot collide with one.
 */
export const DRAFT_CHAPTER_ID = '@draft';

/** A chapter as the picker lists it — where it sits, and what it says right now. */
export type ShareChapterView = {
  id: string;
  /** 1-based position in the day, matching the chapter bar. */
  number: number;
  /** Body as it stands: the live draft for the chapter on screen. */
  body: string;
  /** True for the chapter being written that has no row yet. */
  draft: boolean;
};

/**
 * The day as the picker sees it: every chapter on file plus the unsaved one,
 * with `activeBody` standing in for the chapter being edited.
 *
 * An `activeId` naming no chapter is one not written yet, so it lands at the
 * end — the list the reader ticks and the text that comes out of it are built
 * from the same array and cannot describe different days.
 *
 * Pass `activeId` through `activeJournalChapterId` first: an unset id means
 * the day's first chapter, not a new one.
 */
export function journalShareChapters(
  chapters: readonly JournalChapter[],
  activeId: string | null,
  activeBody: string,
): ShareChapterView[] {
  const views = chapters.map((chapter, index) => ({
    id: chapter.id,
    number: index + 1,
    body: chapter.id === activeId ? activeBody : chapter.body,
    draft: chapter.draft,
  }));
  if (activeId == null || !chapters.some((chapter) => chapter.id === activeId)) {
    views.push({
      id: activeId ?? DRAFT_CHAPTER_ID,
      number: views.length + 1,
      body: activeBody,
      draft: true,
    });
  }
  return views;
}

/** The whole day — what share and copy did before anyone could choose. */
export function defaultShareSelection(views: readonly ShareChapterView[]): string[] {
  return views.map((view) => view.id);
}

/**
 * Add or remove one chapter.
 *
 * The answer is always rebuilt in day order from `views`, so a selection can
 * never drift out of order or keep an id belonging to a chapter that is gone.
 */
export function toggleShareSelection(
  views: readonly ShareChapterView[],
  selected: readonly string[],
  id: string,
): string[] {
  const wanted = new Set(selected);
  if (wanted.has(id)) wanted.delete(id);
  else wanted.add(id);
  return views.filter((view) => wanted.has(view.id)).map((view) => view.id);
}

function pickedWithText(
  views: readonly ShareChapterView[],
  selected: readonly string[],
): ShareChapterView[] {
  const wanted = new Set(selected);
  return views.filter((view) => wanted.has(view.id) && view.body.trim().length > 0);
}

/** The text the picked chapters make, in day order. */
export function journalShareSelectionText(
  views: readonly ShareChapterView[],
  selected: readonly string[],
): string {
  return joinJournalDayBodies(pickedWithText(views, selected).map((view) => view.body));
}

/** What one share carries: the rows, the file's text, and how to name it. */
export type JournalSharePlan = {
  /** The chapters going out, in day order, as they stand in SQLite. */
  picked: { id: string; body: string; number: number }[];
  /** Exactly those bodies, joined. */
  message: string;
  part: NoteSharePart;
};

/**
 * Turn chapters on file into one share.
 *
 * The single invariant this whole feature rests on: `message` is
 * `joinJournalDayBodies` of `picked`, and `picked` is what gets fingerprinted.
 * Both come from the same rows in the same pass, so the file and the record of
 * what was in it cannot describe different text — which is what would leave
 * the share icon stuck on amber forever.
 *
 * `chapterIds` null means the whole day: a day with nothing to choose, and the
 * tracker-shaped case where nobody was ever asked.
 */
export function planJournalShare(
  chapters: readonly JournalChapter[],
  chapterIds: readonly string[] | null,
): JournalSharePlan {
  const wanted = chapterIds ? new Set(chapterIds) : null;
  const picked = chapters
    .map((chapter, index) => ({ id: chapter.id, body: chapter.body, number: index + 1 }))
    .filter((chapter) => !wanted || wanted.has(chapter.id));
  return {
    picked,
    message: joinJournalDayBodies(picked.map((chapter) => chapter.body)).trim(),
    part: { chapters: picked.map((chapter) => chapter.number), total: chapters.length },
  };
}
