import React, { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import DayStateCell, { type DayCellInk } from '../../components/history/DayStateCell';
import { roundedTopBarPath } from '../../components/history/roundedTopBar';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getDateLocale } from '../../i18n';
import { parseLocalDate } from '../../protocol';
import type { ReviewRange } from '../../review';
import { space } from '../../theme/spacing';
import { fontFamily, typeScale } from '../../theme/typography';
import {
  barHeight,
  ledgerColumns,
  nameColumnWidth,
  type LedgerColumns,
  type StripSlot,
} from './reviewGeometry';
import type { ReviewRow } from './reviewRows';

const CELL_HEIGHT = 20;
/** A week with something done never draws shorter than this. */
const MIN_BAR_HEIGHT = 3;
/** A week with something due and nothing done: a tick on the baseline. */
const TICK_HEIGHT = 2;
const ROW_MIN_HEIGHT = 46;
const HEADER_MIN_HEIGHT = 18;
const DASH = '—';

export interface LedgerTracker {
  id: string;
  name: string;
}

type Props = {
  /** Every row, in the user's order — drawn at once, so nothing moves when data lands. */
  trackers: readonly LedgerTracker[];
  /** Rows by tracker id; a tracker without one yet shows its name and an empty line. */
  rows: ReadonlyMap<string, ReviewRow>;
  range: ReviewRange;
  today: string;
  /** The tile's inner width before it has been measured. */
  estimatedWidth: number;
  /** Room after the cells for the strength score; 0 leaves the column out. */
  strengthWidth: number;
  /** Shared with the statement, so both cross-fade when the range changes. */
  fade: Animated.Value;
  onOpenTracker: (trackerId: string) => void;
};

/** What goes over a column: a weekday initial, a Monday's date, a month's initial. */
function markLabel(range: ReviewRange, date: string): string {
  if (range === 'month') return String(parseLocalDate(date).getDate());
  return parseLocalDate(date).toLocaleDateString(
    getDateLocale(),
    range === 'week' ? { weekday: 'narrow' } : { month: 'narrow' },
  );
}

/**
 * Review's one tile: a ledger with a row per tracker and a column per day
 * (or per week, for a year). Every row is drawn on the same columns, so a bad
 * day reads down the page as a column and a struggling tracker across it as a
 * row. Each row is one `Svg`; tapping it opens that tracker's history.
 */
export default function ReviewLedger({
  trackers,
  rows,
  range,
  today,
  estimatedWidth,
  strengthWidth,
  fade,
  onOpenTracker,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation(['review', 'trackers']);
  const { decorations: deco, palette } = useAppTheme();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const innerWidth = measuredWidth ?? estimatedWidth;
  const nameWidth = nameColumnWidth(innerWidth);
  const cellsWidth = Math.max(0, innerWidth - nameWidth - strengthWidth);
  const columns = useMemo(() => ledgerColumns(range, today, cellsWidth), [range, today, cellsWidth]);
  const ink: DayCellInk = { accent: palette.accent, quiet: theme.colors.onSurfaceVariant };

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== measuredWidth) setMeasuredWidth(next);
  };

  let labelsEnd = 0;
  const labels = columns.marks.map((mark) => {
    const marginLeft = mark.x - labelsEnd;
    labelsEnd = mark.x + mark.width;
    return (
      <View key={mark.date} style={{ marginLeft, width: mark.width }}>
        <QuietText numberOfLines={1} style={[styles.mono, range === 'week' && styles.centred]}>
          {markLabel(range, mark.date)}
        </QuietText>
      </View>
    );
  });

  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg }]}>
      <View onLayout={onLayout}>
        <Animated.View
          style={[styles.header, { paddingLeft: nameWidth, opacity: fade }]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {labels}
          {strengthWidth > 0 ? (
            <QuietText
              numberOfLines={1}
              style={[styles.mono, styles.strength, { width: Math.max(strengthWidth, cellsWidth - labelsEnd + strengthWidth) }]}
            >
              {t('row.strength')}
            </QuietText>
          ) : null}
        </Animated.View>

        {trackers.map((tracker) => {
          const row = rows.get(tracker.id);
          const spoken = row ? t(row.spoken.key, row.spoken.params) : tracker.name;
          const score = row?.caption.kind === 'score' ? row.caption.score : null;
          return (
            <Pressable
              key={tracker.id}
              onPress={() => onOpenTracker(tracker.id)}
              accessibilityRole="button"
              accessibilityLabel={
                score === null
                  ? spoken
                  : `${spoken}. ${t('trackers:habitWidget.strengthA11y', { score })}`
              }
              accessibilityHint={t('trackers:homeIdentity.historyHint')}
              style={({ pressed }) => [
                styles.row,
                { borderRadius: deco.radius.sm },
                pressed && { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <View style={[styles.name, { width: nameWidth }]}>
                <Text numberOfLines={1} style={[styles.nameText, { color: theme.colors.onSurface }]}>
                  {tracker.name}
                </Text>
                <Animated.View style={[styles.caption, { opacity: fade }]}>
                  {row ? <RowCaption row={row} /> : null}
                </Animated.View>
              </View>
              <Animated.View style={{ opacity: fade }}>
                <Svg width={cellsWidth} height={CELL_HEIGHT}>
                  {row ? (
                    <RowMarks
                      row={row}
                      columns={columns}
                      ink={ink}
                      track={palette.track}
                      radius={deco.radius.xs}
                      strokeWidth={deco.borderWidth}
                    />
                  ) : null}
                </Svg>
              </Animated.View>
              {strengthWidth > 0 ? (
                <QuietText style={[styles.mono, styles.strength, { width: strengthWidth }]}>
                  {row?.caption.kind === 'score' ? (score ?? DASH) : null}
                </QuietText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The mono line under the name: done over due, or an amount a day. */
function RowCaption({ row }: { row: ReviewRow }) {
  const { t } = useTranslation('review');
  const { caption } = row;
  const figure =
    caption.kind === 'score'
      ? caption.tally
      : caption.value === null
        ? null
        : t('row.perDay', { value: caption.value });
  return <QuietText style={styles.mono}>{figure ?? DASH}</QuietText>;
}

type MarksProps = {
  row: ReviewRow;
  columns: LedgerColumns;
  ink: DayCellInk;
  track: string;
  radius: number;
  strokeWidth: number;
};

/** One row's cells or bars, as fragments of the row's `Svg`. */
function RowMarks({ row, columns, ink, track, radius, strokeWidth }: MarksProps) {
  const { slots } = columns;
  if (row.bars) {
    return row.bars.map((bar, index) => {
      const slot: StripSlot | undefined = slots[index];
      if (!slot || bar.share === null) return null;
      if (bar.share === 0) {
        return (
          <Rect
            key={bar.weekStart}
            x={slot.x}
            y={CELL_HEIGHT - TICK_HEIGHT}
            width={slot.width}
            height={TICK_HEIGHT}
            fill={track}
          />
        );
      }
      const height = barHeight(bar.share, MIN_BAR_HEIGHT, CELL_HEIGHT);
      return (
        <Path
          key={bar.weekStart}
          d={roundedTopBarPath(slot.x, CELL_HEIGHT - height, slot.width, height, radius)}
          fill={ink.accent}
        />
      );
    });
  }

  // The row holds the whole range; the grid may draw only its latest days.
  const days = row.days.slice(-columns.dates.length);
  return days.map((day, index) => {
    const slot: StripSlot | undefined = slots[index];
    if (!slot) return null;
    return (
      <DayStateCell
        key={day.date}
        state={day.state}
        x={slot.x}
        y={0}
        width={slot.width}
        height={CELL_HEIGHT}
        radius={radius}
        strokeWidth={strokeWidth}
        ink={ink}
      />
    );
  });
}

const styles = StyleSheet.create({
  tile: {
    padding: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HEADER_MIN_HEIGHT,
    marginBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    // The pressed wash reaches a little past the row's contents on each side.
    marginHorizontal: -space.sm,
    paddingHorizontal: space.sm,
  },
  name: {
    paddingRight: space.sm,
  },
  nameText: {
    ...typeScale.secondary,
    fontWeight: '500',
  },
  caption: {
    minHeight: 15,
  },
  strength: {
    textAlign: 'right',
  },
  /** Figures and axis labels: the mono face at its regular weight, small. */
  mono: {
    fontFamily: fontFamily.data,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    lineHeight: 15,
  },
  centred: {
    textAlign: 'center',
  },
});
