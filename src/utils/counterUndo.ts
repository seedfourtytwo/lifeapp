/** What one Undo on a counter puts back: the total before a burst of taps. */
export type CounterUndo = {
  elementId: string;
  name: string;
  restoreTo: number;
  added: number;
};

export type CounterTap = {
  elementId: string;
  name: string;
  /** Today's total just before this tap. */
  before: number;
  added: number;
};

/**
 * Fold a tap into the pending undo. Taps on the same counter add up and keep
 * the first tap's starting total; a tap on another counter starts over.
 */
export function nextCounterUndo(prev: CounterUndo | null, tap: CounterTap): CounterUndo {
  if (prev && prev.elementId === tap.elementId) {
    return { ...prev, name: tap.name, added: prev.added + tap.added };
  }
  return { elementId: tap.elementId, name: tap.name, restoreTo: tap.before, added: tap.added };
}
