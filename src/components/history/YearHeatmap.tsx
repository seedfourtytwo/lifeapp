import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import QuietText from '../QuietText';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getDateLocale } from '../../i18n';
import { parseLocalDate } from '../../protocol';
import type { HeatmapColumn } from '../../review';
import { space } from '../../theme/spacing';
import { fontFamily } from '../../theme/typography';
import DayStateCell from './DayStateCell';
import { heatmapLayout, heatmapMonthMarks } from './heatmapLayout';

type Props = {
  columns: readonly HeatmapColumn[];
  /** Spoken as one phrase — 371 cells are texture to a screen reader. */
  accessibilityLabel: string;
};

/**
 * A tracker's year: one column per week, Monday at the top, drawn as a single
 * `Svg` with the same marks as Review. It fills the tile when there is room;
 * on a phone it keeps a legible cell, runs wider than the tile and scrolls,
 * opening on this week.
 */
export default function YearHeatmap({ columns, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { decorations: deco, palette } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [available, setAvailable] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== available) setAvailable(next);
  };

  const grid = heatmapLayout(columns.length, available);
  const marks = heatmapMonthMarks(columns);
  const ink = { accent: palette.accent, quiet: theme.colors.onSurfaceVariant };

  let labelsEnd = 0;
  const labels = marks.map((mark, index) => {
    const x = mark.column * grid.step;
    const end = (marks[index + 1]?.column ?? columns.length) * grid.step;
    const marginLeft = x - labelsEnd;
    labelsEnd = end;
    return (
      <View key={mark.weekStart} style={{ marginLeft, width: end - x }}>
        <QuietText numberOfLines={1} style={styles.month}>
          {parseLocalDate(mark.weekStart).toLocaleDateString(getDateLocale(), { month: 'narrow' })}
        </QuietText>
      </View>
    );
  });

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {available > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View style={{ width: grid.width }}>
            <View style={styles.months}>{labels}</View>
            <Svg width={grid.width} height={grid.height}>
              {columns.map((column, columnIndex) =>
                column.days.map((state, dayIndex) =>
                  state === null ? null : (
                    <DayStateCell
                      key={`${column.weekStart}-${dayIndex}`}
                      state={state}
                      x={columnIndex * grid.step}
                      y={dayIndex * grid.step}
                      width={grid.cell}
                      height={grid.cell}
                      radius={deco.radius.xs}
                      strokeWidth={deco.borderWidth}
                      ink={ink}
                    />
                  ),
                ),
              )}
            </Svg>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const MONTHS_MIN_HEIGHT = 15;

const styles = StyleSheet.create({
  months: {
    flexDirection: 'row',
    minHeight: MONTHS_MIN_HEIGHT,
    marginBottom: space.xs,
  },
  month: {
    fontFamily: fontFamily.data,
    fontSize: 12,
    lineHeight: 15,
  },
  /** The phone grid's height, held until the tile has been measured. */
  placeholder: {
    minHeight: MONTHS_MIN_HEIGHT + space.xs + heatmapLayout(0, 0).height,
  },
});
