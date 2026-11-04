import React, { useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import QuietText from './QuietText';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
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
  /** Plot values (already scaled for display — raw or 0–1 normalized). */
  values: number[];
  /** Per-day “met target / completed” for single-series bar tinting. */
  completed?: boolean[];
  /**
   * Done / not done per day. When comparing, a yes/no series is drawn as a row
   * of squares — as a line it only zigzags between 0 and 1.
   */
  binary?: boolean;
}

export interface InteractiveChartWeatherOverlay {
  /** Parallel to days; null = missing. */
  values: (number | null)[];
  color: string;
}

export interface InteractiveDailyChartProps {
  days: InteractiveChartDay[];
  series: InteractiveChartSeries[];
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  /** Optional MA line for the first series (same scale as series[0].values). */
  movingAverage?: number[];
  weatherOverlay?: InteractiveChartWeatherOverlay;
  /** Shown under the chart. */
  footer?: string;
  /** Long range: hides the numbers over single-series bars. */
  dense?: boolean;
}

const CHART_HEIGHT = 168;
const PAD_TOP = 12;
const PAD_BOTTOM = 4;
const LANE_GAP = space.sm;

export function InteractiveDailyChart({
  days,
  series,
  selectedDate,
  onSelectDay,
  movingAverage,
  weatherOverlay,
  footer,
  dense = false,
}: InteractiveDailyChartProps) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const [width, setWidth] = React.useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const multi = series.length > 1;
  const primary = series[0];

  const { yMax, weatherMax } = useMemo(() => {
    let max = 1;
    for (const s of series) {
      for (const v of s.values) max = Math.max(max, v);
    }
    if (movingAverage) {
      for (const v of movingAverage) max = Math.max(max, v);
    }
    let wMax = 1;
    if (weatherOverlay) {
      for (const v of weatherOverlay.values) {
        if (v != null) wMax = Math.max(wMax, v);
      }
    }
    return { yMax: max, weatherMax: wMax };
  }, [series, movingAverage, weatherOverlay]);

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

  const weatherPoints = useMemo(() => {
    if (!weatherOverlay || n === 0 || colW === 0) return '';
    const parts: string[] = [];
    weatherOverlay.values.forEach((v, i) => {
      if (v == null) return;
      const x = colW * i + colW / 2;
      const y = PAD_TOP + plotHeight - (v / weatherMax) * plotHeight;
      parts.push(`${x},${y}`);
    });
    return parts.join(' ');
  }, [weatherOverlay, n, colW, weatherMax, plotHeight]);

  const showBarLabels = !dense && !multi && n <= 14;
  const laneH = multi ? (plotHeight - LANE_GAP * (series.length - 1)) / series.length : 0;
  const ticks = chartAxisTicks(n, width);
  const tickStyle = n <= 7 ? 'weekday' : 'day';

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartBlock} onLayout={onLayout}>
        {width > 0 && n > 0 ? (
          <Svg width={width} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>
            {!multi && primary
              ? primary.values.map((value, i) => {
                  const completed = primary.completed?.[i] ?? value > 0;
                  const barH =
                    value <= 0 ? 2 : Math.max(2, (value / yMax) * plotHeight);
                  const x = colW * i + colW * 0.18;
                  const barW = colW * 0.64;
                  const y = CHART_HEIGHT - PAD_BOTTOM - barH;
                  const selected = days[i]?.date === selectedDate;
                  const fill = completed
                    ? primary.color
                    : theme.colors.surfaceVariant;
                  return (
                    <Rect
                      key={`bar-${primary.id}-${days[i]?.date ?? i}`}
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={deco.radius.xs}
                      fill={fill}
                      opacity={selected ? 1 : completed ? 0.85 : 0.45}
                      stroke={selected ? theme.colors.onSurface : 'transparent'}
                      strokeWidth={selected ? 2 : 0}
                    />
                  );
                })
              : null}

            {multi
              ? series.map((s, lane) => {
                  // Comparing: one lane per series, top to bottom in chip order.
                  // Each series is already scaled 0–1 against its own best day.
                  const laneTop = PAD_TOP + lane * (laneH + LANE_GAP);
                  const laneBottom = laneTop + laneH;
                  return s.values.map((v, i) => {
                    const cx = colW * i + colW / 2;
                    const key = `${s.id}-${days[i]?.date ?? i}`;
                    if (v <= 0) {
                      return (
                        <Circle
                          key={key}
                          cx={cx}
                          cy={laneTop + laneH / 2}
                          r={1.5}
                          fill={theme.colors.outline}
                        />
                      );
                    }
                    if (s.binary) {
                      const side = Math.min(colW * 0.7, laneH * 0.7, 14);
                      return (
                        <Rect
                          key={key}
                          x={cx - side / 2}
                          y={laneTop + (laneH - side) / 2}
                          width={side}
                          height={side}
                          rx={Math.min(deco.radius.sm, side / 4)}
                          fill={s.color}
                        />
                      );
                    }
                    const barW = Math.min(colW * 0.5, 10);
                    const barH = Math.max(2, v * laneH);
                    return (
                      <Rect
                        key={key}
                        x={cx - barW / 2}
                        y={laneBottom - barH}
                        width={barW}
                        height={barH}
                        rx={Math.min(deco.radius.sm, barW / 4)}
                        fill={s.color}
                      />
                    );
                  });
                })
              : null}

            {maPoints.length > 0 ? (
              <Polyline
                points={maPoints}
                fill="none"
                stroke={theme.colors.tertiary}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.75}
              />
            ) : null}

            {weatherPoints.length > 0 && weatherOverlay ? (
              <Polyline
                points={weatherPoints}
                fill="none"
                stroke={weatherOverlay.color}
                strokeWidth={1.5}
                strokeDasharray="2 4"
                opacity={0.8}
              />
            ) : null}

            {selectedDate
              ? (() => {
                  const idx = days.findIndex((d) => d.date === selectedDate);
                  if (idx < 0) return null;
                  const x = colW * idx + colW / 2;
                  return (
                    <Line
                      x1={x}
                      y1={PAD_TOP}
                      x2={x}
                      y2={CHART_HEIGHT - PAD_BOTTOM}
                      stroke={theme.colors.primary}
                      strokeWidth={1}
                      opacity={0.35}
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
            const value = primary?.values[i] ?? 0;
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
                    variant="labelSmall"
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
              variant="labelSmall"
              style={[
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
        <QuietText variant="bodySmall" style={styles.footer}>
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
    fontSize: 9,
  },
  valueLabelSpacer: {
    height: space.xs,
  },
  labelRow: {
    marginTop: space.xs,
    minHeight: 18,
  },
  dayLabel: {
    position: 'absolute',
    top: 0,
    width: AXIS_LABEL_SLOT,
    textAlign: 'center',
  },
  /** Selection reads as weight and a stronger token, not as less dimming. */
  dayLabelSelected: {
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    marginTop: space.sm,
  },
});
