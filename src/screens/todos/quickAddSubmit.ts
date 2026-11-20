/**
 * How long after filing a further submit is taken for the same key press.
 * Android reports a hardware Enter to the field on key-down and on key-up, so
 * one press submits twice; a second press on purpose comes later than this.
 */
const SAME_PRESS_MS = 400;

/**
 * What a submit from the quick-add field means: text is filed, an empty field
 * puts the keyboard away — unless it is the echo of the press that just filed.
 *
 * @param msSinceFiled Time since the last todo was filed from the field; null if none was.
 */
export function quickAddSubmitAction({
  hasText,
  msSinceFiled,
}: {
  hasText: boolean;
  msSinceFiled: number | null;
}): 'file' | 'dismiss' | 'ignore' {
  // Whatever the field holds: the echo can also arrive before the field has
  // re-rendered empty, and would file the same todo twice.
  if (msSinceFiled != null && msSinceFiled < SAME_PRESS_MS) return 'ignore';
  return hasText ? 'file' : 'dismiss';
}
