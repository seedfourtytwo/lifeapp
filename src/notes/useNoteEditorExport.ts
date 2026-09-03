import { useCallback, useMemo, useState, type MutableRefObject } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { JournalChapter } from './journalChapters';
import {
  DRAFT_CHAPTER_ID,
  defaultShareSelection,
  journalShareChapters,
  journalShareSelectionText,
  toggleShareSelection,
  type ShareChapterView,
} from './journalShareSelection';
import {
  journalDayShareStatus,
  noteShareStatus,
  type NoteShareStatus,
} from './noteShareStatus';
import type { useNoteEditorChrome } from './useNoteEditorChrome';

/** Sharing hands text to the OS; copying hands it to the clipboard. Same choice. */
export type SharePickerMode = 'share' | 'copy';

type Options = {
  isJournal: boolean;
  chapters: readonly JournalChapter[];
  /** Chapter on screen, already resolved through `activeJournalChapterId`. */
  activeChapterId: string | null;
  draft: string;
  /** Live draft — what an action must act on, not the last render's copy. */
  draftRef: MutableRefObject<string>;
  persistedBody: string;
  /** Last shared fingerprint per chapter id (journals). */
  chapterShareFingerprints: Readonly<Record<string, string>>;
  /** Last shared fingerprint for a tracker day note. */
  shareFingerprint: string | null;
  saving: boolean;
  dictationBusy: boolean;
  chrome: ReturnType<typeof useNoteEditorChrome>;
  /** Write any debounced draft before the text leaves the editor. */
  flush: () => void;
  onShare?: (body: string, chapterIds: string[] | null) => void | Promise<void>;
  copiedLabel: string;
  copyErrorTitle: string;
  copyErrorBody: string;
};

/**
 * Getting text out of the editor: share it, copy it, and the colour that says
 * whether what left is still what the journal says.
 *
 * A day with one chapter has nothing to choose, so share and copy run straight
 * through and behave exactly as they did before chapters existed — including
 * every tracker day note, which has no chapters at all. Two or more and the
 * picker opens with the whole day ticked: the least surprising default is the
 * one that keeps the old behaviour two taps away. Copy goes through the same
 * step as share, because "which of this leaves the journal" should have one
 * answer rather than one per destination.
 *
 * The status lives here too — it is the same arithmetic read from the other
 * end: one fingerprint per chapter, against what that chapter says now.
 */
export function useNoteEditorExport({
  isJournal,
  chapters,
  activeChapterId,
  draft,
  draftRef,
  persistedBody,
  chapterShareFingerprints,
  shareFingerprint,
  saving,
  dictationBusy,
  chrome,
  flush,
  onShare,
  copiedLabel,
  copyErrorTitle,
  copyErrorBody,
}: Options) {
  const [mode, setMode] = useState<SharePickerMode | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const activeViewId = activeChapterId ?? DRAFT_CHAPTER_ID;

  /** The day as it stands on screen — the list the picker ticks. */
  const views = useMemo(
    () => (isJournal ? journalShareChapters(chapters, activeChapterId, draft) : []),
    [isJournal, chapters, activeChapterId, draft],
  );

  /**
   * Only the chapter on screen can differ from SQLite; the rest were read from
   * it, so their draft and persisted text are the same string.
   */
  const chapterState = useCallback(
    (view: ShareChapterView) => ({
      draft: view.body,
      persisted: view.id === activeViewId ? persistedBody : view.body,
      lastSharedFingerprint: chapterShareFingerprints[view.id] ?? null,
    }),
    [activeViewId, persistedBody, chapterShareFingerprints],
  );

  const statuses = useMemo(() => {
    const map: Record<string, NoteShareStatus> = {};
    for (const view of views) map[view.id] = noteShareStatus(chapterState(view));
    return map;
  }, [views, chapterState]);

  /** Day-level never/stale/current for the header icon. */
  const status: NoteShareStatus = isJournal
    ? journalDayShareStatus(views.map(chapterState))
    : noteShareStatus({
        draft,
        persisted: persistedBody,
        lastSharedFingerprint: shareFingerprint,
      });

  /**
   * The text an export carries: the chosen chapters joined, or the whole day
   * when there was nothing to choose. Built from the live draft so the chapter
   * on screen goes out as it stands, not as it was last written.
   */
  const exportText = useCallback(
    (ids: string[] | null) => {
      const body = draftRef.current;
      if (!isJournal) return body;
      const live = journalShareChapters(chapters, activeChapterId, body);
      return journalShareSelectionText(live, ids ?? defaultShareSelection(live));
    },
    [isJournal, chapters, activeChapterId, draftRef],
  );

  const runCopy = useCallback(
    async (ids: string[] | null) => {
      if (saving || chrome.sharing) return;
      const body = exportText(ids);
      if (!body.trim()) return;
      try {
        await Clipboard.setStringAsync(body);
        chrome.showCopied(copiedLabel);
      } catch {
        Alert.alert(copyErrorTitle, copyErrorBody);
      }
    },
    [saving, chrome, exportText, copiedLabel, copyErrorTitle, copyErrorBody],
  );

  /**
   * Share hands the *selection* down rather than the text: the session writes
   * the draft first and reads the chosen chapters back, so the file and the
   * fingerprints it records come from the same rows.
   */
  const runShare = useCallback(
    async (ids: string[] | null) => {
      if (chrome.sharingRef.current || saving || dictationBusy || !onShare) return;
      flush();
      if (!draftRef.current.trim()) return;
      chrome.sharingRef.current = true;
      chrome.setSharing(true);
      try {
        await onShare(draftRef.current, ids);
      } finally {
        chrome.sharingRef.current = false;
        chrome.setSharing(false);
      }
    },
    [chrome, saving, dictationBusy, onShare, flush, draftRef],
  );

  const run = useCallback(
    (running: SharePickerMode, ids: string[] | null) => {
      if (running === 'copy') void runCopy(ids);
      else void runShare(ids);
    },
    [runCopy, runShare],
  );

  /** Ask for the action; open the picker only when there is a choice to make. */
  const request = useCallback(
    (next: SharePickerMode) => {
      const live = isJournal
        ? journalShareChapters(chapters, activeChapterId, draftRef.current)
        : [];
      if (live.length > 1) {
        setSelected(defaultShareSelection(live));
        setMode(next);
        return;
      }
      run(next, null);
    },
    [isJournal, chapters, activeChapterId, draftRef, run],
  );

  const cancel = useCallback(() => setMode(null), []);

  const confirm = useCallback(() => {
    const running = mode;
    const ids = selected;
    setMode(null);
    if (running) run(running, ids);
  }, [mode, selected, run]);

  const toggle = useCallback(
    (id: string) => setSelected((current) => toggleShareSelection(views, current, id)),
    [views],
  );

  const selectAll = useCallback(() => setSelected(defaultShareSelection(views)), [views]);
  const selectNone = useCallback(() => setSelected([]), []);

  return {
    mode,
    views,
    selected,
    statuses,
    status,
    request,
    confirm,
    cancel,
    toggle,
    selectAll,
    selectNone,
  };
}
