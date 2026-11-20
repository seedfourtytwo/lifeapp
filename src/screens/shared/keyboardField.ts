/**
 * Geometry for a text field written on a scrolling page — the quick-add line
 * on Today — rather than in a sheet.
 *
 * With Android edge-to-edge the window does not shrink for the keyboard, so
 * the page keeps its height and the keyboard lies over its lower half. The
 * list gives up the covered part itself (`keyboardOverlap`) and brings the
 * field into what is left (`keyboardRevealDelta`). Everything below the list —
 * the dock — stays where it is, behind the keyboard.
 *
 * All values are window coordinates.
 */

type Rect = { x: number; y: number; width: number; height: number };

/**
 * Where the keyboard's top edge is, or null while it is down. React Native
 * reports the keyboard's height without the navigation bar it stands on.
 */
export function keyboardTopInWindow({
  windowHeight,
  safeBottom,
  keyboardHeight,
}: {
  windowHeight: number;
  safeBottom: number;
  keyboardHeight: number;
}): number | null {
  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) return null;
  return windowHeight - safeBottom - keyboardHeight;
}

/** How much of a view ending at `viewBottom` lies under the keyboard. */
export function keyboardOverlap({
  viewBottom,
  keyboardTop,
}: {
  viewBottom: number;
  keyboardTop: number | null;
}): number {
  if (keyboardTop == null) return 0;
  return Math.max(0, viewBottom - keyboardTop);
}

/**
 * How far to scroll so the field sits over the keyboard with `peek` of the
 * list still showing under it — the row a todo filed from the field lands in.
 * Positive scrolls the content up. Zero when the field is already there: a
 * field high on the page is not dragged down to the keyboard.
 */
export function keyboardRevealDelta({
  fieldTop,
  fieldBottom,
  viewportTop,
  keyboardTop,
  peek,
}: {
  fieldTop: number;
  fieldBottom: number;
  viewportTop: number;
  keyboardTop: number;
  peek: number;
}): number {
  if (fieldTop < viewportTop) return fieldTop - viewportTop;
  const up = fieldBottom + peek - keyboardTop;
  if (up <= 0) return 0;
  // The field itself outranks the room under it.
  return Math.min(up, fieldTop - viewportTop);
}

/** A touch that began anywhere but on the field's own line. */
export function touchIsOutside(touch: { x: number; y: number }, field: Rect): boolean {
  return (
    touch.x < field.x ||
    touch.x > field.x + field.width ||
    touch.y < field.y ||
    touch.y > field.y + field.height
  );
}
