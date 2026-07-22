import type { NoteEditorTarget } from './types';

/** Stable key so the sheet re-seeds when target or day changes. */
export function noteEditorSessionKey(
  target: NoteEditorTarget,
  date: string,
): string {
  if (target.kind === 'tracker') {
    return `tracker:${target.elementId}:${date}`;
  }
  return `journal:${date}`;
}
