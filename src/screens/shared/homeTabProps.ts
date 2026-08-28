import type { HomeNotebookChip } from '../../notes';

/** Props Home passes to each tracker tab (Habits / Counters). */
export type HomeTrackerTabProps = {
  notebooks: HomeNotebookChip[];
  onDictateNotebook: (notebookId: string) => void;
  onEditNotebook: (notebookId: string) => void;
  /** True while Home's journal sheet is open — dismisses this tab's tracker note sheet. */
  journalOpen?: boolean;
  /** False while another Home tab is active — dismisses this tab's tracker note sheet. */
  notesActive?: boolean;
  /** Called before opening a tracker note so Home can dismiss the journal sheet. */
  onBeforeOpenTrackerNote?: () => void;
  /** Lets Home lock the tab swipe while this tab's note sheet is open. */
  onTrackerNotesOpenChange?: (open: boolean) => void;
  /** Lets Home lock the tab swipe while dragging to reorder. */
  onTrackerDragActiveChange?: (active: boolean) => void;
};
