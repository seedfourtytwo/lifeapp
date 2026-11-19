/**
 * Review data layer — pure maths over day histories, plus one loader.
 * `loadReviewData` → `reviewDayStates` per tracker and window (`reviewWindowDates`)
 * → `completionRate` / `weeklyBars` / `yearHeatmap`; `reviewSummary` for the
 * headline; `reviewStrengthSeries` for the score and its line. Due, done and
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
  REVIEW_RANGE_DAYS,
  reviewSummary,
  reviewWindowDates,
  type CompletionRate,
  type ReviewComparison,
  type ReviewRange,
  type ReviewSlipped,
  type ReviewSummary,
} from './rates';
export { HEATMAP_WEEKS, weeklyBars, yearHeatmap, type HeatmapColumn, type WeeklyBar } from './charts';
export { loadReviewData } from './loadReview';
export { reviewStrengthSeries } from './strength';
export type { StrengthPoint } from '../utils/strengthScore';
