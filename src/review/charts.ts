import { shiftDateString, weekStartDateString } from '../protocol';
import type { ReviewDay, ReviewDayState } from './dayStates';

export const HEATMAP_WEEKS = 53;

/** One heatmap column: a week, Monday first; null where the day is not in the range. */
export interface HeatmapColumn {
  weekStart: string;
  days: readonly (ReviewDayState | null)[];
}

/** 53 week columns ending with today's week, each 7 cells Monday → Sunday. */
export function yearHeatmap(days: readonly ReviewDay[], today: string): HeatmapColumn[] {
  const stateOf = new Map(days.map((day) => [day.date, day.state]));
  const lastWeek = weekStartDateString(today);
  const columns: HeatmapColumn[] = [];
  for (let back = HEATMAP_WEEKS - 1; back >= 0; back--) {
    const weekStart = shiftDateString(lastWeek, -7 * back);
    const cells: (ReviewDayState | null)[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const date = shiftDateString(weekStart, offset);
      cells.push(date > today ? null : (stateOf.get(date) ?? null));
    }
    columns.push({ weekStart, days: cells });
  }
  return columns;
}
