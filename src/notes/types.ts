import { DAY_NOTE_BODY_MAX_LENGTH } from '../protocol';

/** Max body length shared by tracker notes and daily journals. */
export const NOTE_BODY_MAX_LENGTH = DAY_NOTE_BODY_MAX_LENGTH;

export type TrackerNoteTarget = {
  kind: 'tracker';
  elementId: string;
  /** Shown under the sheet title (tracker name). */
  label: string;
};

export type JournalNoteTarget = {
  kind: 'journal';
  /** Shown under the sheet title. */
  label?: string;
};

export type NoteEditorTarget = TrackerNoteTarget | JournalNoteTarget;

export function noteEditorHeading(target: NoteEditorTarget): string {
  return target.kind === 'journal' ? 'Journal' : 'Note';
}

export function noteEditorLabel(target: NoteEditorTarget): string {
  if (target.kind === 'journal') {
    // Date alone is enough under "Journal" — no redundant "Day" prefix.
    return target.label?.trim() || '';
  }
  return target.label;
}
