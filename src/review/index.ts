/**
 * Review data layer — pure maths over day histories, plus one loader.
 * `loadReviewData` → `reviewDayStates` per tracker over a `reviewPeriod` →
 * `reviewSummary` for the headline, `dayTallies` for the heat map and its
 * facts, `trackerStandings` for the ranking. A tracker's own history draws
 * `yearHeatmap` and `reviewStrengthSeries`. Due, done and
 * skipped come from `src/protocol/dayRules.ts`, never re-derived here.
 */
export {
  isMissable,
  reviewDayStates,
  type ReviewDay,
  type ReviewDayState,
  type ReviewTracker,
  type ReviewTrackerData,
} from './dayStates';
export {
  completionRate,
  REVIEW_YEAR_WEEKS,
  reviewPeriod,
  reviewSummary,
  reviewWindowDates,
  type CompletionRate,
  type ReviewComparison,
  type ReviewPeriod,
  type ReviewRange,
  type ReviewSummary,
} from './rates';
export {
  bestWeekday,
  dayCounts,
  dayTallies,
  fullDayRun,
  heatLevel,
  isFullDay,
  trackerStandings,
  type DayCounts,
  type DayTally,
  type HeatLevel,
  type TrackerStanding,
} from './days';
export { HEATMAP_WEEKS, yearHeatmap, type HeatmapColumn } from './charts';
export { loadReviewData } from './loadReview';
export { reviewStrengthSeries } from './strength';
export type { StrengthPoint } from '../utils/strengthScore';
