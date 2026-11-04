import { space } from '../theme/spacing';

/**
 * Room to keep under a centred dialog while the keyboard is up. Paper's Dialog
 * does not move for the keyboard, and with Android edge-to-edge the window no
 * longer shrinks either, so the keyboard simply covered the lower fields and
 * the Save button. A bottom margin of this size keeps the dialog centred in
 * the space that is left.
 */
export function dialogKeyboardLift(keyboardHeight: number): number {
  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) return 0;
  return keyboardHeight + space.lg;
}

/** Android only sends the did-events; iOS sends will-events early enough to move with it. */
export function keyboardEventNames(os: string): {
  show: 'keyboardWillShow' | 'keyboardDidShow';
  hide: 'keyboardWillHide' | 'keyboardDidHide';
} {
  return os === 'ios'
    ? { show: 'keyboardWillShow', hide: 'keyboardWillHide' }
    : { show: 'keyboardDidShow', hide: 'keyboardDidHide' };
}
