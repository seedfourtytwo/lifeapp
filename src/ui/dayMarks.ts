/**
 * What one day was, for a tracker: the vocabulary of the week's dashes and of
 * the road's centre line, so the two always agree.
 */
export type DayMark =
  /** Kept. */
  | 'done'
  /** Counted, and not kept: a dim dash, never a gap. */
  | 'missed'
  /** Did not count: before the tracker existed, or not one of its days. */
  | 'notCounted'
  /** Still open. */
  | 'today';

/** A missed day's dash on the road: there, but dim. */
const MISSED_LEVEL = 0.16;

/**
 * The road's dashes for those days, oldest first: bright when kept, dim when
 * missed, none for a day that does not count. Today is where the car is, so
 * it draws no dash behind it.
 */
export function roadDashes(days: readonly DayMark[]): (number | null)[] {
  return days.map((day) => (day === 'done' ? 1 : day === 'missed' ? MISSED_LEVEL : null));
}

