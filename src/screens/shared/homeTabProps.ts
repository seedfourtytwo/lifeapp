import type { HomeNotebookChip } from '../../notes';

/** Props Home passes to the Today page. */
export type HomeTrackerTabProps = {
  notebooks: HomeNotebookChip[];
  onDictateNotebook: (notebookId: string) => void;
  onEditNotebook: (notebookId: string) => void;
  /** True while Home's journal sheet is open — dismisses this page's tracker note sheet. */
  journalOpen?: boolean;
  /** False while another Home page is active — dismisses this page's tracker note sheet. */
  notesActive?: boolean;
  /** Called before opening a tracker note so Home can dismiss the journal sheet. */
  onBeforeOpenTrackerNote?: () => void;
  /** Lets Home lock the page swipe while this page's note sheet is open. */
  onTrackerNotesOpenChange?: (open: boolean) => void;
  /** Lets Home lock the page swipe while dragging to reorder. */
  onTrackerDragActiveChange?: (active: boolean) => void;
};
