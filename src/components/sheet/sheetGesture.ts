import { space } from '../../theme/spacing';

/**
 * How a pull on the editor sheet resolves. Pure, so the thresholds are tested
 * rather than tuned by feel on one phone.
 */

/** A pull of a third of the sheet closes it… */
const DISMISS_SHARE = 1 / 3;
/** …but never less than this on a short sheet, so a nudge is not a close… */
const DISMISS_FLOOR_PX = 72;
/** …and never more than this on a tall one, so a long form is not hard to leave. */
const DISMISS_CEILING_PX = 160;
/** A downward flick this fast (px/ms) closes from a short pull. */
const FLICK_VELOCITY = 1;
/** A flick still needs some travel, or a tap with jitter would throw the edit away. */
const FLICK_MIN_PX = 24;

/** The sheet follows the finger down and never lifts above where it rests. */
export function dragOffset(dy: number): number {
  return Math.max(0, dy);
}

export function shouldDismissOnRelease({
  dy,
  vy,
  sheetHeight,
}: {
  dy: number;
  vy: number;
  sheetHeight: number;
}): boolean {
  if (dy <= 0) return false;
  const distance = Math.min(
    DISMISS_CEILING_PX,
    Math.max(DISMISS_FLOOR_PX, sheetHeight * DISMISS_SHARE),
  );
  if (dy >= distance) return true;
  return vy >= FLICK_VELOCITY && dy >= FLICK_MIN_PX;
}

/**
 * Room under the footer. Android draws edge to edge, so the window does not
 * shrink for the keyboard: the sheet pads itself by the keyboard's height, and
 * when the keyboard is down, by the navigation bar's inset instead — the
 * keyboard already covers that inset, so the two never add up.
 */
export function sheetBottomPadding({
  keyboardHeight,
  safeBottom,
}: {
  keyboardHeight: number;
  safeBottom: number;
}): number {
  const keyboard = Number.isFinite(keyboardHeight) && keyboardHeight > 0 ? keyboardHeight : 0;
  return (keyboard > 0 ? keyboard : safeBottom) + space.lg;
}
