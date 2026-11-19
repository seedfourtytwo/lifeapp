import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

/**
 * - `todoOpen`: an empty rounded square — a todo still to do.
 * - `todoDone`: the square filled, with a check.
 * - `habitDone`: a filled disc with a check.
 * - `habitSkipped`: a filled disc with a dash.
 */
export type TodayMarkKind = 'todoOpen' | 'todoDone' | 'habitDone' | 'habitSkipped';

/** The widget draws its marks on a 28-unit square; these are the same paths. */
const VIEWBOX = 28;
const SQUARE = 'M9,4 L19,4 A5,5 0 0,1 24,9 L24,19 A5,5 0 0,1 19,24 L9,24 A5,5 0 0,1 4,19 L4,9 A5,5 0 0,1 9,4 Z';
const DISC = 'M14,2 A12,12 0 1,1 14,26 A12,12 0 1,1 14,2 Z';
const CHECK = 'M8.5,14.5 L12.25,18.25 L19.5,10.25';
const DASH = 'M9.5,14 L18.5,14';

/** The mark's drawn box; a todo's square fills 20 of the 28 units, a disc 24. */
const SIZE = 30;

/**
 * The marks of the rows that are written on the page rather than set on a
 * tile, in the widget's own vocabulary (`life_widget_todo_box`,
 * `life_widget_disc_done`, `life_widget_disc_skipped`): a square is a todo, a
 * disc is a habit; hollow is open, filled is settled.
 */
export default function TodayMark({ kind }: { kind: TodayMarkKind }) {
  const { colors } = useTheme();
  const square = kind === 'todoOpen' || kind === 'todoDone';
  const hollow = kind === 'todoOpen';

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      {hollow ? (
        <Path
          d={SQUARE}
          fill="none"
          stroke={colors.onSurfaceVariant}
          strokeWidth={2}
        />
      ) : (
        <>
          <Path d={square ? SQUARE : DISC} fill={colors.primary} />
          <Path
            d={kind === 'habitSkipped' ? DASH : CHECK}
            fill="none"
            stroke={colors.onPrimary}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}
