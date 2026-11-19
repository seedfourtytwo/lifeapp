import { computeStrengthSeries, type StrengthPoint } from '../utils/strengthScore';
import { dayRulesSchedule } from '../utils/trackerDayRules';
import { isMissable, type ReviewTrackerData } from './dayStates';

/**
 * A tracker's strength score after each day, oldest first, ending today — the
 * same walk as the Home score, so the last point is the tile's score. Empty
 * for a counter without a target (it has no score) and before creation.
 */
export function reviewStrengthSeries(data: ReviewTrackerData, today: string): StrengthPoint[] {
  const { tracker, history } = data;
  if (!isMissable(tracker.rules)) return [];
  return computeStrengthSeries({
    schedule: dayRulesSchedule(tracker.rules),
    history,
    today,
    createdOn: tracker.createdOn,
  });
}
