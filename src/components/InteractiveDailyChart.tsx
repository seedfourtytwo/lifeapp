import React, { useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import QuietText from './QuietText';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { roundedTopBarPath } from './history/roundedTopBar';
import { AXIS_LABEL_SLOT, chartAxisTicks } from '../utils/chartAxis';
import { formatAxisLabel } from '../utils/dates';

/**
 * Axis and bar labels sit in fixed slots under narrow columns. They cannot
 * reflow or wrap without colliding, so scaling is capped rather than allowed
 * to overrun.
 */
const CHART_LABEL_MAX_SCALE = 1.2;

export interface InteractiveChartDay {
  date: string;
  label: string;
}

export interface InteractiveChartSeries {
  id: string;
  color: string;
  /** Plot values, one per day. */
  values: number[];
  /** Per-day “met target / completed” for bar tinting. */
  completed?: boolean[];
}

export interface InteractiveDailyChartProps {
  days: InteractiveChartDay[];
  series: InteractiveChartSeries;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  /** Optional MA line (same scale as the series values). */
  movingAverage?: number[];
  /** Shown under the chart. */
  footer?: string;
  /** Long range: hides the numbers over the bars. */
  dense?: boolean;
}

const CHART_HEIGHT = 176;
const PAD_TOP = 12;
/** Room under the bars for the selected day's dot. */
const PAD_BOTTOM = 12;
/** An empty day is a short stub on the axis, so the run of days stays legible. */
const STUB_HEIGHT = 4;
const SELECTED_DOT_RADIUS = 3;

export function InteractiveDailyChart({
  days,
  series,
  selectedDate,
  onSelectDay,
  movingAverage,
  footer,
  dense = false,
}: InteractiveDailyChartProps) {
  const theme = useTheme();
  const { decorations: deco, palette } = useAppTheme();
  const [width, setWidth] = React.useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const yMax = useMemo(() => {
    let max = 1;
    for (const v of series.values) max = Math.max(max, v);
    if (movingAverage) {
      for (const v of movingAverage) max = Math.max(max, v);
    }
    return max;
  }, [series, movingAverage]);

  const n = days.length;
  const colW = n > 0 && width > 0 ? width / n : 0;

  const maPoints = useMemo(() => {
    if (!movingAverage || n === 0 || colW === 0) return '';
    return movingAverage
      .map((v, i) => {
        const x = colW * i + colW / 2;
        const y = PAD_TOP + plotHeight - (v / yMax) * plotHeight;
        return `${x},${y}`;
      })
      .join(' ');
  }, [movingAverage, n, colW, yMax, plotHeight]);

  const showBarLabels = !dense && n <= 14;
  const ticks = chartAxisTicks(n, width);
  const tickStyle = n <= 7 ? 'weekday' : 'day';

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartBlock} onLayout={onLayout}>
        {width > 0 && n > 0 ? (
          <Svg width={width} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>
            {series.values.map((value, i) => {
                  const completed = series.completed?.[i] ?? value > 0;
                  const barH =
                    value <= 0 ? STUB_HEIGHT : Math.max(STUB_HEIGHT, (value / yMax) * plotHeight);
                  const barW = colW * 0.6;
                  const x = colW * i + (colW - barW) / 2;
                  const y = CHART_HEIGHT - PAD_BOTTOM - barH;
                  return (
                    <Path
                      key={`bar-${series.id}-${days[i]?.date ?? i}`}
                      d={roundedTopBarPath(x, y, barW, barH, deco.radius.sm)}
                      fill={completed ? series.color : palette.track}
                    />
                  );
            })}

            {maPoints.length > 0 ? (
              <Polyline
                points={maPoints}
                fill="none"
                stroke={theme.colors.onSurfaceVariant}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            ) : null}

            {selectedDate
              ? (() => {
                  const idx = days.findIndex((d) => d.date === selectedDate);
                  if (idx < 0) return null;
                  // The selected day: one ink dot under its column, not a ring
                  // around the bar, so every bar keeps its own colour.
                  return (
                    <Circle
                      cx={colW * idx + colW / 2}
                      cy={CHART_HEIGHT - PAD_BOTTOM / 2}
                      r={SELECTED_DOT_RADIUS}
                      fill={theme.colors.onSurface}
                    />
                  );
                })()
              : null}
          </Svg>
        ) : (
          <View style={{ height: CHART_HEIGHT }} />
        )}

        {/* Touch columns */}
        <View style={[styles.touchRow, { height: CHART_HEIGHT }]} pointerEvents="box-none">
          {days.map((day, i) => {
            const value = series.values[i] ?? 0;
            return (
              <Pressable
                key={day.date}
                style={styles.touchCol}
                onPress={() => onSelectDay(day.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: day.date === selectedDate }}
                accessibilityLabel={`${day.label}, ${value}`}
              >
                {showBarLabels ? (
                  <QuietText
                    style={styles.valueLabel}
                    maxFontSizeMultiplier={CHART_LABEL_MAX_SCALE}
                  >
                    {value > 0 ? formatShort(value) : ''}
                  </QuietText>
                ) : (
                  <View style={styles.valueLabelSpacer} />
                )}
                <View style={{ flex: 1 }} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Day labels: as many as fit, always ending on the latest day. */}
      <View style={styles.labelRow}>
        {ticks.map((i) => {
          const day = days[i]!;
          const selected = day.date === selectedDate;
          const left = Math.min(
            Math.max(colW * i + colW / 2 - AXIS_LABEL_SLOT / 2, 0),
            width - AXIS_LABEL_SLOT,
          );
          return (
            <Text
              key={`lbl-${day.date}`}
              style={[
                typeScale.caption,
                styles.dayLabel,
                { left, color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
                selected && styles.dayLabelSelected,
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={CHART_LABEL_MAX_SCALE}
              importantForAccessibility="no"
            >
              {formatAxisLabel(day.date, tickStyle)}
            </Text>
          );
        })}
      </View>

      {footer ? (
        <QuietText style={[typeScale.caption, styles.footer]}>
          {footer}
        </QuietText>
      ) : null}
    </View>
  );
}

function formatShort(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: space.xs,
  },
  chartBlock: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  touchRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  touchCol: {
    flex: 1,
    alignItems: 'center',
  },
  valueLabel: {
    minHeight: 14,
    fontSize: 11,
    lineHeight: 14,
  },
  valueLabelSpacer: {
    height: space.xs,
  },
  labelRow: {
    marginTop: space.xs,
    minHeight: 20,
  },
  dayLabel: {
    position: 'absolute',
    top: 0,
    width: AXIS_LABEL_SLOT,
    textAlign: 'center',
  },
  /** Selection reads as weight and a stronger token, not as less dimming. */
  dayLabelSelected: {
    fontWeight: '600',
  },
  footer: {
    marginTop: space.md,
  },
});
