import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getDateLocale } from '../../i18n';
import { parseLocalDate, shiftDateString, weekStartDateString } from '../../protocol';
import { heatLevel, REVIEW_YEAR_WEEKS, type DayTally, type ReviewRange } from '../../review';
import type { HeatStep } from '../../theme/palette';
import { space } from '../../theme/spacing';
import { fontFamily, typeScale } from '../../theme/typography';
import { calendarWeeks, yearGrid, yearMonthMarks } from './reviewGeometry';

type Props = {
  range: ReviewRange;
  /** Every day the range draws, oldest first, the ones after today included. */
  days: readonly DayTally[];
  today: string;
  /** The tile's inner width before it has been measured: a Year is sized from it. */
  estimatedWidth: number;
  /** The whole grid as one phrase — its squares are texture to a screen reader. */
  accessibilityLabel: string;
};

/** The tile's padding; the screen takes it off its own width to estimate the grid's. */
export const HEAT_MAP_PADDING = space.md;
const CELL_GAP = space.sm;
const SWATCH = 12;
/**
 * A day's number sits in a square that shares the tile's width and cannot
 * grow, so it scales only this far: past it two digits leave the square.
 */
const NUMERAL_MAX_SCALE = 1.5;
const DASH = '–';

/**
 * How each day went, one square a day: the darker the square, the more of
 * that day's plan was done. A week and a month are a calendar with the day's
 * number in each square; a year is 52 week columns of small squares.
 */
export default function ReviewHeatMap({ range, days, today, estimatedWidth, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('review');
  const { decorations: deco, palette } = useAppTheme();

  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg }]}>
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        {range === 'year' ? (
          <YearSquares days={days} today={today} estimatedWidth={estimatedWidth} />
        ) : (
          <Calendar days={days} today={today} withTally={range === 'week'} />
        )}
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <QuietText style={typeScale.caption}>{t('heat.less')}</QuietText>
        {palette.heat.map((step) => (
          <View key={step.fill} style={[styles.swatch, { backgroundColor: step.fill, borderRadius: deco.radius.xs }]} />
        ))}
        <QuietText style={typeScale.caption}>{t('heat.more')}</QuietText>
      </View>
    </View>
  );
}

type CalendarProps = {
  days: readonly DayTally[];
  today: string;
  /** Week only: "done/planned" under each square. */
  withTally: boolean;
};

/** Weekday initials across, Monday first, then the days in weeks. */
function Calendar({ days, today, withTally }: CalendarProps) {
  const theme = useTheme();
  const { decorations: deco, palette } = useAppTheme();
  const tallyOf = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const weeks = useMemo(() => calendarWeeks(days.map((day) => day.date)), [days]);
  if (days.length === 0) return null;
  const monday = weekStartDateString(days[0].date);

  return (
    <View style={styles.calendar}>
      <View style={styles.week}>
        {Array.from({ length: 7 }, (_, weekday) => (
          <QuietText key={weekday} numberOfLines={1} style={[styles.small, styles.weekday]}>
            {parseLocalDate(shiftDateString(monday, weekday)).toLocaleDateString(getDateLocale(), {
              weekday: 'narrow',
            })}
          </QuietText>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((date, weekday) => {
            const tally = date ? tallyOf.get(date) : undefined;
            if (!date || !tally) return <View key={weekday} style={styles.column} />;
            const coming = date > today;
            const step: HeatStep | null = coming ? null : palette.heat[heatLevel(tally)];
            return (
              <View key={weekday} style={styles.column}>
                <View
                  testID="heat-day"
                  style={[
                    styles.day,
                    { borderRadius: deco.radius.sm, borderWidth: deco.borderWidth },
                    // A day to come is an empty outline; a day that has been is
                    // its shade edge to edge, ringed when it is today.
                    step
                      ? { backgroundColor: step.fill, borderColor: date === today ? theme.colors.onSurface : step.fill }
                      : { borderColor: palette.track },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={NUMERAL_MAX_SCALE}
                    style={[styles.numeral, { color: theme.colors[step ? step.onFill : 'onSurfaceVariant'] }]}
                  >
                    {Number(date.slice(8))}
                  </Text>
                </View>
                {withTally ? (
                  <QuietText
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    maxFontSizeMultiplier={NUMERAL_MAX_SCALE}
                    style={[styles.small, styles.centred]}
                  >
                    {coming ? '' : tally.planned === 0 ? DASH : `${tally.done}/${tally.planned}`}
                  </QuietText>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type YearProps = Pick<Props, 'days' | 'today' | 'estimatedWidth'>;

/** 52 week columns, Monday on top, month initials over the column each month starts in. */
function YearSquares({ days, today, estimatedWidth }: YearProps) {
  const { palette } = useAppTheme();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const width = measuredWidth ?? estimatedWidth;
  const grid = yearGrid(REVIEW_YEAR_WEEKS, width);
  const marks = useMemo(() => yearMonthMarks(days.map((day) => day.date), today), [days, today]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== measuredWidth) setMeasuredWidth(next);
  };

  let labelsEnd = 0;
  const labels = marks.map((mark, index) => {
    const x = mark.column * grid.pitch;
    const end = index + 1 < marks.length ? marks[index + 1].column * grid.pitch : width;
    const marginLeft = x - labelsEnd;
    labelsEnd = end;
    return (
      <View key={mark.date} style={{ marginLeft, width: end - x }}>
        <QuietText numberOfLines={1} maxFontSizeMultiplier={NUMERAL_MAX_SCALE} style={styles.small}>
          {parseLocalDate(mark.date).toLocaleDateString(getDateLocale(), { month: 'narrow' })}
        </QuietText>
      </View>
    );
  });

  return (
    <View onLayout={onLayout} style={styles.year}>
      <View style={styles.months}>{labels}</View>
      <Svg width={width} height={grid.height}>
        {days.map((day, index) =>
          day.date > today ? null : (
            <Rect
              key={day.date}
              x={Math.floor(index / 7) * grid.pitch}
              y={(index % 7) * grid.pitch}
              width={grid.cell}
              height={grid.cell}
              // A quarter of the square: rounded, and still a square at 4dp.
              rx={grid.cell / 4}
              fill={palette.heat[heatLevel(day)].fill}
            />
          ),
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: HEAT_MAP_PADDING,
    gap: space.md,
  },
  calendar: {
    gap: CELL_GAP,
  },
  week: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  /** Seven of these share the tile's width. */
  column: {
    flex: 1,
    gap: space.xs,
  },
  /** A square as wide as its column. */
  day: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeral: {
    fontFamily: fontFamily.data,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    lineHeight: 16,
  },
  year: {
    gap: space.xs,
  },
  months: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  /** Axis labels and tallies: the mono face, small. */
  small: {
    fontFamily: fontFamily.data,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    lineHeight: 15,
  },
  centred: {
    textAlign: 'center',
  },
});
