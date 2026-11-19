import { confirm } from '../components/sheet/confirm';
import { i18n } from '../i18n';

/**
 * The two things the note sheet asks before destroying text.
 *
 * Kept out of the sheet because they are policy, not layout: which wording,
 * which button is destructive, and — the part that matters — that both of them
 * exist at all. Clearing a body and deleting a chapter are the only
 * irreversible actions in the editor.
 */

/** Confirm wiping the body of the note or chapter on screen. */
export function confirmClearNoteBody(opts: {
  noun: string;
  /** True while the mic is open — the wording admits a take is in flight. */
  listening: boolean;
  onConfirm: () => void;
}): void {
  const { noun, listening, onConfirm } = opts;
  const t = i18n.t.bind(i18n);
  void confirm({
    title: listening
      ? t('common:note.clearExistingTitle')
      : t('common:note.clearConfirmTitle', { noun }),
    message: listening
      ? t('common:note.clearExistingBody', { noun })
      : t('common:note.clearConfirmBody', { noun }),
    confirmLabel: listening ? t('common:note.clearExistingAction') : t('common:note.clear'),
    cancelLabel: t('common:note.cancel'),
    destructive: true,
  }).then((confirmed) => {
    if (confirmed) onConfirm();
  });
}

/** Confirm deleting one chapter of a notebook day. `number` is 1-based. */
export function confirmDeleteChapter(opts: {
  number: number;
  onConfirm: () => void;
}): void {
  const { number, onConfirm } = opts;
  const t = i18n.t.bind(i18n);
  void confirm({
    title: t('journal:chapters.deleteTitle', { number }),
    message: t('journal:chapters.deleteBody'),
    confirmLabel: t('journal:chapters.deleteAction'),
    cancelLabel: t('common:note.cancel'),
    destructive: true,
  }).then((confirmed) => {
    if (confirmed) onConfirm();
  });
}
