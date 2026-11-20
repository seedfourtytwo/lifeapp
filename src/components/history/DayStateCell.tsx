import React from 'react';
import { Circle, Rect } from 'react-native-svg';
import type { ReviewDayState } from '../../review';

/** The colours a day cell is drawn in. */
export interface DayCellInk {
  /** Done, and the ring round today while it is still open: the accent. */
  accent: string;
  /** Missed rings and skipped dots: the quiet ink, which holds 3:1 on a tile. */
  quiet: string;
}

type Props = {
  state: ReviewDayState;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  /** A ring's stroke; thinned on cells too small to keep a hole inside it. */
  strokeWidth: number;
  ink: DayCellInk;
};

const MAX_DOT_RADIUS = 2;

/**
 * One day, as an SVG fragment — the same marks on Review, in its legend and
 * on the history heatmap. States differ by shape, never by colour alone:
 * done is filled, missed an empty ring, skipped a centred dot, today still
 * open a ring in the accent, and a day that was not scheduled is not drawn.
 */
export default function DayStateCell({ state, x, y, width, height, radius, strokeWidth, ink }: Props) {
  if (state === 'none' || width <= 0 || height <= 0) return null;
  const short = Math.min(width, height);

  if (state === 'done') {
    return <Rect x={x} y={y} width={width} height={height} rx={radius} fill={ink.accent} />;
  }

  if (state === 'skipped') {
    return (
      <Circle
        cx={x + width / 2}
        cy={y + height / 2}
        r={Math.min(MAX_DOT_RADIUS, short / 3)}
        fill={ink.quiet}
      />
    );
  }

  // The stroke straddles its path, so the path sits half a stroke inside the cell.
  const stroke = Math.min(strokeWidth, short / 4);
  return (
    <Rect
      x={x + stroke / 2}
      y={y + stroke / 2}
      width={width - stroke}
      height={height - stroke}
      rx={Math.max(0, radius - stroke / 2)}
      fill="none"
      stroke={state === 'open' ? ink.accent : ink.quiet}
      strokeWidth={stroke}
    />
  );
}
