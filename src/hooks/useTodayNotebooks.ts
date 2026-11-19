import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import {
  useNoteEditorSession,
  type HomeNotebookChip,
  type NoteEditorSession,
} from '../notes';
import { useJournalNotebookStore } from '../store/journalNotebookStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { useAppCalendarNow } from './useAppCalendarNow';

export type TodayNotebooks = {
  /** Every journal notebook, with how many chapters each has today. */
  notebooks: HomeNotebookChip[];
  /** The journal sheet's session — hand it to a `NoteEditorHost`. */
  noteEditor: NoteEditorSession;
  /** True while the journal sheet is open. */
  journalOpen: boolean;
  /** Today's entry in a notebook, straight into dictation. */
  dictateNotebook: (notebookId: string) => void;
  /** Today's entry in a notebook, no mic. */
  editNotebook: (notebookId: string) => void;
  /** Refetch the chips — after a notebook was created, say. */
  reloadNotebooks: () => void;
};

/**
 * Today's journal notebooks and the sheet that writes in them: what a screen
 * needs to show the notebook buttons beside the date. Home uses it for the
 * Today page; the Food screen uses its own copy, since it is pushed over Home
 * and has to host its own sheet.
 *
 * The chips refresh on mount, on screen focus, whenever the sheet closes, and
 * when the app calendar day rolls over.
 */
export function useTodayNotebooks(): TodayNotebooks {
  const now = useAppCalendarNow();
  const [notebooks, setNotebooks] = useState<HomeNotebookChip[]>([]);
  const reloadNotebooksStore = useJournalNotebookStore((s) => s.reload);

  const reloadTodayNotebooks = useCallback(async () => {
    const today = currentAppCalendarDate(now);
    try {
      await reloadNotebooksStore();
      const db = await getDatabase();
      const todayCounts = await dailyJournalRepo.getJournalChapterCountsOnDate(db, today);
      const rows = useJournalNotebookStore.getState().notebooks;
      setNotebooks(
        rows.map((notebook) => ({
          id: notebook.id,
          name: notebook.name,
          color: notebook.color,
          icon: notebook.icon,
          hasToday: (todayCounts.get(notebook.id) ?? 0) > 0,
          todayCount: todayCounts.get(notebook.id) ?? 0,
        })),
      );
    } catch {
      // Non-fatal — icons stay empty until next focus.
    }
  }, [now, reloadNotebooksStore]);

  const noteEditor = useNoteEditorSession({
    onSaved: (date, _body, target) => {
      if (target.kind !== 'journal') return;
      if (date !== currentAppCalendarDate(now)) return;
      void reloadTodayNotebooks();
    },
  });
  const journalOpen = noteEditor.session != null;

  // `reloadTodayNotebooks` is keyed on `now`, so this also covers day rollover.
  useEffect(() => {
    if (journalOpen) return;
    void reloadTodayNotebooks();
  }, [journalOpen, reloadTodayNotebooks]);

  useFocusEffect(
    useCallback(() => {
      void reloadTodayNotebooks();
    }, [reloadTodayNotebooks]),
  );

  const openTodayNotebook = (notebookId: string, opts?: { dictate?: boolean }) => {
    const today = currentAppCalendarDate(now);
    // The chips lag a notebook created moments ago (the food journal), so fall
    // back to the store the creation already refreshed — otherwise the sheet
    // opens on a nameless, glyphless journal.
    const chip =
      notebooks.find((notebook) => notebook.id === notebookId) ??
      useJournalNotebookStore
        .getState()
        .notebooks.find((notebook) => notebook.id === notebookId);
    void noteEditor.open(
      {
        kind: 'journal',
        notebookId,
        label: chip?.name,
        icon: chip?.icon,
      },
      today,
      opts?.dictate ? { dictate: true } : undefined,
    );
  };

  /**
   * Stable handlers. `openTodayNotebook` closes over `now`, the chips and the
   * editor session, so it is a fresh function every render — screens get these
   * instead, or a memoised one would re-render every time its host does.
   */
  const openTodayNotebookRef = useRef(openTodayNotebook);
  openTodayNotebookRef.current = openTodayNotebook;

  const dictateNotebook = useCallback(
    (notebookId: string) => openTodayNotebookRef.current(notebookId, { dictate: true }),
    [],
  );
  const editNotebook = useCallback(
    (notebookId: string) => openTodayNotebookRef.current(notebookId),
    [],
  );
  const reloadNotebooks = useCallback(() => {
    void reloadTodayNotebooks();
  }, [reloadTodayNotebooks]);

  return { notebooks, noteEditor, journalOpen, dictateNotebook, editNotebook, reloadNotebooks };
}
