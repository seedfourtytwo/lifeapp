import type { NoteEditorTarget } from './types';

/**
 * Stable key so the sheet re-seeds when target or day changes.
 *
 * A journal chapter is part of the key: moving between two chapters of one day
 * has to reseed the draft, and before v22 there was only ever one so the
 * notebook and the date were enough. `first` stands for "whichever chapter
 * opens by default", which is what a caller with no chapter in mind asks for.
 */
export function noteEditorSessionKey(
  target: NoteEditorTarget,
  date: string,
): string {
  if (target.kind === 'tracker') {
    return `tracker:${target.elementId}:${date}`;
  }
  return `journal:${target.notebookId}:${date}:${target.entryId ?? 'first'}`;
}
