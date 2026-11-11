/** What one Undo on a counter takes back: the events a burst of taps wrote. */
export type CounterUndo = {
  elementId: string;
  name: string;
  eventIds: string[];
  added: number;
};

export type CounterTap = {
  elementId: string;
  name: string;
  /** The event this tap wrote. */
  eventId: string;
  added: number;
};

/**
 * Fold a tap into the pending undo. Taps on the same counter add up and are
 * undone together; a tap on another counter starts over.
 */
export function nextCounterUndo(prev: CounterUndo | null, tap: CounterTap): CounterUndo {
  if (prev && prev.elementId === tap.elementId) {
    return {
      ...prev,
      name: tap.name,
      eventIds: [...prev.eventIds, tap.eventId],
      added: prev.added + tap.added,
    };
  }
  return {
    elementId: tap.elementId,
    name: tap.name,
    eventIds: [tap.eventId],
    added: tap.added,
  };
}
