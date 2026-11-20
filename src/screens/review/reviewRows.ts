import { rowKindColour } from '../../kinds/rowKind';
import type { ReviewTracker, TrackerStanding } from '../../review';
import type { KindColour } from '../../theme/palette';
import { dayRulesSchedule } from '../../utils/trackerDayRules';
import type { ReviewCopy } from './reviewCopy';

/** A tracker doing at least this share of its plan is holding; under it, slipping. */
const HOLDING_FROM = 0.5;

/** One row of Holding or Slipping. */
export interface StandingRow {
  id: string;
  name: string;
  /** Colours the row's dot and bar. */
  kind: KindColour;
  /** Done over planned, 0–1: the bar's fill. */
  share: number;
  /** "done / planned", padded so every row's figures sit in the same columns of the mono face. */
  figure: string;
  /** What a screen reader says for the row. */
  spoken: ReviewCopy;
}

export interface StandingLists {
  holding: StandingRow[];
  slipping: StandingRow[];
}

function kindOf({ rules }: ReviewTracker): KindColour {
  return rowKindColour(
    rules.kind === 'habit' ? { kind: 'habit', trackingMode: rules.config.trackingMode } : { kind: 'counter' },
  );
}

/**
 * The ranked `standings` as two lists, in the order given. `trackerOf` names
 * a tracker; a standing it cannot find — archived since the load — is dropped.
 */
export function standingRows(
  standings: readonly TrackerStanding[],
  trackerOf: (trackerId: string) => { tracker: ReviewTracker; name: string } | undefined,
): StandingLists {
  const widest = (pick: (standing: TrackerStanding) => number) =>
    Math.max(0, ...standings.map((standing) => String(pick(standing)).length));
  const doneWidth = widest((standing) => standing.done);
  const plannedWidth = widest((standing) => standing.planned);

  const lists: StandingLists = { holding: [], slipping: [] };
  for (const { trackerId, done, planned, skipped, share } of standings) {
    const found = trackerOf(trackerId);
    if (!found) continue;
    const { tracker, name } = found;
    const unit = dayRulesSchedule(tracker.rules).type === 'times_per_week' ? 'sessions' : 'days';
    (share >= HOLDING_FROM ? lists.holding : lists.slipping).push({
      id: trackerId,
      name,
      kind: kindOf(tracker),
      share,
      figure: `${String(done).padStart(doneWidth)} / ${String(planned).padStart(plannedWidth)}`,
      spoken: { key: `spoken.${unit}`, params: { name, done, count: planned, missed: planned - done, skipped } },
    });
  }
  return lists;
}
