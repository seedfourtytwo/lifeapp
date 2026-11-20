import {
  HEATMAP_WEEKS,
  reviewDayStates,
  reviewStrengthSeries,
  reviewWindowDates,
  yearHeatmap,
  type HeatmapColumn,
  type ReviewTrackerData,
} from '../../review';

/** Days the strength line covers. */
export const STRENGTH_LINE_DAYS = 90;

/** A tracker's past year as the history screen draws it. */
export interface YearReview {
  /** 53 week columns ending with today's week. */
  columns: HeatmapColumn[];
  done: number;
  missed: number;
  skipped: number;
  /** The strength score after each of the last 90 days; empty when it has none. */
  strength: number[];
}

export function yearReview(data: ReviewTrackerData, today: string): YearReview {
  // 53 whole weeks reach back at most 370 days, so this window holds every column.
  const dates = reviewWindowDates(today, HEATMAP_WEEKS * 7);
  const days = reviewDayStates(data.tracker, data.history, dates, today);
  const columns = yearHeatmap(days, today);
  const count = { done: 0, missed: 0, skipped: 0 };
  for (const column of columns) {
    for (const state of column.days) {
      if (state === 'done' || state === 'missed' || state === 'skipped') count[state]++;
    }
  }
  return {
    columns,
    ...count,
    strength: reviewStrengthSeries(data, today)
      .slice(-STRENGTH_LINE_DAYS)
      .map((point) => point.score),
  };
}
