import { useCallback, useEffect, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';

/** How long "Copied" stays on the menu item before it reverts. */
const COPY_FEEDBACK_MS = 2000;
/** Paper Menu overlay animation (~220ms) plus a beat so Alert/remount don't race it. */
const MENU_SETTLE_MS = 280;

type Options = {
  visible: boolean;
  date: string | null;
  sessionKey: string | null;
  /** Clears the mic's own state — stable for the life of the sheet. */
  onResetDictation: () => void;
  /** Clears dictation notices without resetting it — stable, likewise. */
  onClearDictationNotices: () => void;
};

/**
 * The note sheet's chrome: the overflow menu, the copy confirmation, whether a
 * share is in flight and whether sharing exists on this device at all.
 *
 * None of it is the draft, and all of it has to be forgotten when the sheet
 * moves to another note — or another chapter of the same day, which is a new
 * session key for the same notebook. Keeping it here means the sheet does not
 * carry five pieces of state and three timers that have nothing to do with
 * what is being written.
 */
export function useNoteEditorChrome({
  visible,
  date,
  sessionKey,
  onResetDictation,
  onClearDictationNotices,
}: Options) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuEpoch, setMenuEpoch] = useState(0);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const [shareAvailable, setShareAvailable] = useState(true);

  const seededKeyRef = useRef<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, []);

  /** Stable: touches only setState and refs, so the session effect can depend on it. */
  const reset = useCallback(() => {
    onResetDictation();
    clearCopyTimer();
    setCopyFeedback(null);
    setMenuOpen(false);
  }, [clearCopyTimer, onResetDictation]);

  /** Show a confirmation on the copy item, then let it revert. */
  const showCopied = useCallback(
    (label: string) => {
      clearCopyTimer();
      setCopyFeedback(label);
      copyTimerRef.current = setTimeout(() => {
        setCopyFeedback(null);
        copyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    },
    [clearCopyTimer],
  );

  /**
   * Close the menu, let its overlay finish, then act. Running an Alert or a
   * remount into a closing Paper Menu drops the next tap on the floor.
   */
  const closeMenuThen = useCallback((action: () => void) => {
    setMenuOpen(false);
    if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
    menuTimerRef.current = setTimeout(() => {
      menuTimerRef.current = null;
      setMenuEpoch((n) => n + 1);
      action();
    }, MENU_SETTLE_MS);
  }, []);

  useEffect(() => {
    if (!visible || !date || !sessionKey) {
      if (!visible) {
        seededKeyRef.current = null;
        setSharing(false);
        sharingRef.current = false;
        reset();
      } else {
        onClearDictationNotices();
      }
      return;
    }
    if (seededKeyRef.current === sessionKey) return;
    setSharing(false);
    sharingRef.current = false;
    reset();
    seededKeyRef.current = sessionKey;
  }, [visible, date, sessionKey, reset, onClearDictationNotices]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void Sharing.isAvailableAsync().then((ok) => {
      if (!cancelled) setShareAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Unmount-only: `clearCopyTimer` is stable, so listing it does not re-arm this.
  useEffect(
    () => () => {
      clearCopyTimer();
      if (menuTimerRef.current) {
        clearTimeout(menuTimerRef.current);
        menuTimerRef.current = null;
      }
    },
    [clearCopyTimer],
  );

  return {
    copyFeedback,
    showCopied,
    menuOpen,
    setMenuOpen,
    menuEpoch,
    closeMenuThen,
    sharing,
    setSharing,
    sharingRef,
    shareAvailable,
  };
}
