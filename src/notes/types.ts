import { i18n } from '../i18n';
import type { TrackerIconId } from '../protocol';

export type HomeNotebookChip = {
  id: string;
  name: string;
  color: string;
  icon?: TrackerIconId;
  hasToday: boolean;
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
  /** Row id when known; load/save key off notebook + date. */
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
