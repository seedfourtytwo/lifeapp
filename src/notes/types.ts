import { i18n } from '../i18n';
import type { TrackerIconId } from '../protocol';

export type HomeNotebookChip = {
  id: string;
  name: string;
  color: string;
  icon?: TrackerIconId;
  hasToday: boolean;
  /** Chapters written in this notebook today — the icon badges two or more. */
  todayCount: number;
};

export type TrackerNoteTarget = {
  kind: 'tracker';
  elementId: string;
  /** Sheet title (tracker name). */
  label: string;
};

export type JournalNoteTarget = {
  kind: 'journal';
  notebookId: string;
  /**
   * Which chapter of the notebook day. Unset means the day's first, which is
   * what opening a notebook from Home plainly asks for. An id that is not on
   * file yet is a chapter the reader has just started.
   */
  entryId?: string;
  /** Sheet title (notebook name). */
  label?: string;
  /** Glyph beside the journal title; Home catalog icon when set. */
  icon?: TrackerIconId;
};

export type NoteEditorTarget = TrackerNoteTarget | JournalNoteTarget;

export function noteEditorKind(target: NoteEditorTarget): 'note' | 'journal' {
  return target.kind === 'journal' ? 'journal' : 'note';
}

export function noteEditorHeading(target: NoteEditorTarget): string {
  return target.kind === 'journal'
    ? i18n.t('common:note.journalHeading')
    : i18n.t('common:note.noteHeading');
}

export function noteEditorLabel(target: NoteEditorTarget): string {
  return target.label?.trim() || '';
}

/** Name first; generic “Journal” / “Note” only if the label is missing. */
export function noteEditorTitle(target: NoteEditorTarget): string {
  return noteEditorLabel(target) || noteEditorHeading(target);
}
