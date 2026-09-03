import type { DailyJournal } from '../protocol';

/**
 * Naming a chapter without asking anyone to name it.
 *
 * Chapters have no titles — a journal that demands one before you can write is
 * a journal you stop writing in. The jump list therefore labels each chapter
 * with its number and the first few words of what is in it, which is enough to
 * tell "the walk" from "the argument" at a glance.
 */

/** Words of body text shown beside a chapter number. */
const PREVIEW_WORDS = 5;

/** First few words of a chapter, on one line. Empty for a blank chapter. */
export function journalChapterPreview(body: string): string {
  const words = body.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return '';
  if (words.length <= PREVIEW_WORDS) return words.join(' ');
  return `${words.slice(0, PREVIEW_WORDS).join(' ')}…`;
}

/** A chapter as the editor addresses it: a row on file, or a blank one not yet written. */
export type JournalChapter = {
  /** Row id — minted up front for a chapter that has no text yet. */
  id: string;
  body: string;
  /** True until the first save puts it in SQLite. */
  draft: boolean;
};

/** The day's chapters as the editor sees them: every row, oldest first. */
export function toJournalChapters(rows: DailyJournal[]): JournalChapter[] {
  return rows.map((row) => ({ id: row.id, body: row.body, draft: false }));
}

/**
 * Where the editor should land when it opens.
 *
 * `entryId` wins when it names a chapter that exists — that is the reader
 * asking for one. Otherwise the first chapter, and index 0 for an empty day so
 * the caller can seed a blank draft there.
 */
export function journalChapterIndex(
  chapters: readonly JournalChapter[],
  entryId: string | undefined,
): number {
  if (!entryId) return 0;
  const found = chapters.findIndex((chapter) => chapter.id === entryId);
  return found >= 0 ? found : 0;
}

/**
 * Which chapter a target is really editing.
 *
 * A journal target with no `entryId` means "the notebook's day" — that is what
 * tapping a notebook on Home asks for — and the editor lands on its first
 * chapter. Resolving that here matters: treating an unset id as "a chapter not
 * on file" would count one chapter as two and drop the draft out of the day's
 * shared text. Null only when the day is genuinely empty.
 */
export function activeJournalChapterId(
  chapters: readonly JournalChapter[],
  entryId: string | null | undefined,
): string | null {
  if (entryId) return entryId;
  return chapters[0]?.id ?? null;
}
