import { useEffect, useRef } from 'react';
import { useTodayTrackerNotes } from '../../hooks/useTodayTrackerNotes';
import { useNoteEditorSession } from '../../notes';
import type { HomeTrackerTabProps } from './homeTabProps';

type Options = {
  /** Tracker ids on this tab — the day-note batch load keys off these. */
  elementIds: string[];
  now: Date;
} & Pick<
  HomeTrackerTabProps,
  'journalOpen' | 'notesActive' | 'onTrackerNotesOpenChange'
>;

/**
 * Per-tracker day-note sheet for a Home tab (Habits / Counters).
 *
 * Owns the three couplings both tabs need and neither should re-derive:
 * the sheet closes when Home's journal opens or the tab goes inactive, the
 * day-note icons reload once the sheet closes, and Home is told while the
 * sheet is open so it can lock the pager swipe.
 */
export function useHomeTrackerNotes({
  elementIds,
  now,
  journalOpen = false,
  notesActive = true,
  onTrackerNotesOpenChange,
}: Options) {
  const { notesToday, reloadNotesToday, applySaved } = useTodayTrackerNotes(
    elementIds,
    now,
  );

  const noteEditor = useNoteEditorSession({
    onSaved: (date, body, target) => {
      if (target.kind !== 'tracker') return;
      applySaved(date, target.elementId, body);
    },
  });

  const { session, dismiss } = noteEditor;
  const isOpen = session != null;

  useEffect(() => {
    if (journalOpen || !notesActive) dismiss();
  }, [dismiss, journalOpen, notesActive]);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      void reloadNotesToday();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, reloadNotesToday]);

  useEffect(() => {
    if (!notesActive) return;
    onTrackerNotesOpenChange?.(isOpen);
  }, [isOpen, notesActive, onTrackerNotesOpenChange]);

  return { notesToday, reloadNotesToday, noteEditor };
}
