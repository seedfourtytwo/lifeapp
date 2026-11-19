import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '../../components/sheet/confirm';
import { useTranslation } from 'react-i18next';

/** One thing that just happened, and the way back from it. */
export type PendingUndo = {
  /** What the bar says, e.g. "Water +3". */
  message: string;
  /** Takes it back. A rejection is reported as "could not save". */
  undo: () => void | Promise<void>;
  /**
   * Runs when the window closes *without* Undo — it ran out, something newer
   * took the bar, or the page was left. A deferred write (a todo delete) goes
   * here; most undos have nothing to settle.
   */
  settle?: () => void;
  /** Who offered it, so that owner can withdraw it without touching another's. */
  owner?: string;
};

export type UndoBar = {
  /** The bar's text; `null` hides it. */
  message: string | null;
  /** Offer a way back. Whatever was pending is settled first: one bar, one undo. */
  offer: (next: PendingUndo) => void;
  /** The bar's Undo button. */
  runUndo: () => void;
  /**
   * Close the window without undoing. With `owner`, only if the pending undo is
   * that owner's.
   */
  settle: (owner?: string) => void;
};

/**
 * The page's single undo bar.
 *
 * Today holds habits, counters and todos, and each can offer a way back; three
 * bars would stack on one another. So there is one slot: the latest action owns
 * it, and taking it over settles whatever was there.
 */
export function useUndoBar(): UndoBar {
  const { t } = useTranslation('common');
  const [message, setMessage] = useState<string | null>(null);
  // The bar's callbacks fire after state has moved on (Paper calls onDismiss
  // right after the action), so the pending record is read from a ref.
  const pendingRef = useRef<PendingUndo | null>(null);

  const settle = useCallback((owner?: string) => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (owner != null && pending.owner !== owner) return;
    pendingRef.current = null;
    setMessage(null);
    pending.settle?.();
  }, []);

  const offer = useCallback(
    (next: PendingUndo) => {
      settle();
      pendingRef.current = next;
      setMessage(next.message);
    },
    [settle],
  );

  const runUndo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setMessage(null);
    Promise.resolve()
      .then(pending.undo)
      .catch((error: unknown) => {
        notify({
          title: t('alerts.couldNotSave'),
          message: error instanceof Error ? error.message : t('errors.somethingWentWrong'),
        });
      });
  }, [t]);

  // Unmounting mid-window still settles: what was deleted stays deleted.
  useEffect(() => () => settle(), [settle]);

  return { message, offer, runUndo, settle };
}
