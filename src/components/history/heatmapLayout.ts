import type { HeatmapColumn } from '../../review';

/** The smallest cell that still tells a ring from a dot. */
const MIN_CELL = 5;
/** Past this a year of cells stops reading as texture. */
const MAX_CELL = 16;
const CELL_GAP = 2;

export interface HeatmapLayout {
  cell: number;
  gap: number;
  /** Cell plus gap: the distance from one column or row to the next. */
  step: number;
  width: number;
  height: number;
}

/**
 * Cell size for `columns` week columns in `available` width: the grid fills
 * the width when it can, and otherwise keeps its smallest legible cell and
 * runs wider than the tile, which then scrolls.
 */
export function heatmapLayout(columns: number, available: number): HeatmapLayout {
  const fitted = columns > 0 ? (available + CELL_GAP) / columns - CELL_GAP : MIN_CELL;
  const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, fitted));
  const step = cell + CELL_GAP;
  return {
    cell,
    gap: CELL_GAP,
    step,
    width: Math.max(0, columns * step - CELL_GAP),
    height: 7 * step - CELL_GAP,
  };
}

/** A month's initial goes over the column holding that month's first Monday. */
export interface HeatmapMonthMark {
  column: number;
  /** The Monday that column starts on. */
  weekStart: string;
}

export function heatmapMonthMarks(columns: readonly HeatmapColumn[]): HeatmapMonthMark[] {
  return columns.flatMap(({ weekStart }, column) =>
    Number(weekStart.slice(8)) <= 7 ? [{ column, weekStart }] : [],
  );
}
