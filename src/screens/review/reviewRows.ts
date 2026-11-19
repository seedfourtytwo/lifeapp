import {
  completionRate,
  isMissable,
  REVIEW_RANGE_DAYS,
  reviewDayStates,
  reviewStrengthSeries,
  reviewWindowDates,
  weeklyBars,
  type ReviewDay,
  type ReviewRange,
  type ReviewTrackerData,
} from '../../review';
import { dayRulesSchedule } from '../../utils/trackerDayRules';
import type { ReviewCopy } from './reviewCopy';

/** One week of a Year row: null draws nothing, 0 a baseline tick, above 0 a bar. */
export interface ReviewBar {
  weekStart: string;
  share: number | null;
}

/**
 * A row's figures. A tracker that can miss a day shows done over due under
 * its name and has a strength score, which gets a column of its own where
 * there is room; a counter without a target shows what it logs on a logged
 * day. A null part is drawn as a dash.
 */
export type ReviewRowCaption =
  | { kind: 'score'; tally: string | null; score: string | null }
  | { kind: 'perDay'; value: string | null };

/** Everything one row of the ledger shows for a range. */
export interface ReviewRow {
  id: string;
  name: string;
  caption: ReviewRowCaption;
  /** One state per day of the range, oldest first. */
  days: ReviewDay[];
  /** Year only: one bar per week. */
  bars: ReviewBar[] | null;
  /** What a screen reader says for the row. */
  spoken: ReviewCopy;
}

export interface ReviewRowInput {
  data: ReviewTrackerData;
  name: string;
  /** Daily totals by date — read only for a counter without a target. */
  totals?: ReadonlyMap<string, number>;
}

const DAYS_IN_WEEK = 7;

/**
 * An average as a row can carry it: one decimal while it is under 10, where
 * the decimal is most of the figure, and a whole number from there up.
 */
export function formatPerDay(average: number): string {
  if (average >= 10) return String(Math.round(average));
  const rounded = Math.round(average * 10) / 10;
  if (rounded >= 10) return '10';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** The strength score a row shows: null for a tracker that has none. */
export function trackerScore(data: ReviewTrackerData, today: string): number | null {
  const series = reviewStrengthSeries(data, today);
  return series.length === 0 ? null : series[series.length - 1].score;
}

/** A tracker's row for `range` ending `today`; `score` is its strength now. */
export function reviewRow(
  input: ReviewRowInput,
  range: ReviewRange,
  today: string,
  score: number | null,
): ReviewRow {
  const { data, name, totals } = input;
  const { tracker, history } = data;
  const dates = reviewWindowDates(today, REVIEW_RANGE_DAYS[range]);
  const days = reviewDayStates(tracker, history, dates, today);
  const base = { id: tracker.id, name, days };

  if (!isMissable(tracker.rules)) {
    const logged = days.filter((day) => day.state === 'done');
    const total = logged.reduce((sum, day) => sum + (totals?.get(day.date) ?? 0), 0);
    return {
      ...base,
      caption: {
        kind: 'perDay',
        value: logged.length === 0 ? null : formatPerDay(total / logged.length),
      },
      // Nothing to miss, so a week is sized by how many of its days were logged.
      bars:
        range === 'year'
          ? weeklyBars(days).map(({ weekStart, done }) => ({
              weekStart,
              share: done === 0 ? null : done / DAYS_IN_WEEK,
            }))
          : null,
      spoken: { key: 'spoken.logged', params: { name, count: logged.length } },
    };
  }

  const { done, due } = completionRate(days);
  const unit = dayRulesSchedule(tracker.rules).type === 'times_per_week' ? 'sessions' : 'days';
  const skipped = days.filter((day) => day.state === 'skipped').length;
  return {
    ...base,
    caption: {
      kind: 'score',
      tally: due === 0 ? null : `${done}/${due}`,
      score: score === null ? null : String(score),
    },
    bars:
      range === 'year'
        ? weeklyBars(days).map(({ weekStart, rate }) => ({ weekStart, share: rate }))
        : null,
    spoken:
      due === 0
        ? { key: 'spoken.nothingDue', params: { name } }
        : { key: `spoken.${unit}`, params: { name, done, count: due, missed: due - done, skipped } },
  };
}
