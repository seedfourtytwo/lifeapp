import React, { useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';

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
  /** When true, hide per-bar numeric labels (dense ranges). */
  dense?: boolean;
}

const CHART_HEIGHT = 168;
const PAD_TOP = 12;
const PAD_BOTTOM = 4;

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
  const { decorations: deco, isCartoon } = useAppTheme();
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

  const toY = (value: number, max: number) =>
    PAD_TOP + plotHeight - (value / max) * plotHeight;

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

  return (
    <View style={styles.wrapper}>
      <View style={styles.chartBlock} onLayout={onLayout}>
        {width > 0 && n > 0 ? (
          <Svg width={width} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>
            {/* Baseline */}
            <Line
              x1={0}
              y1={CHART_HEIGHT - PAD_BOTTOM}
              x2={width}
              y2={CHART_HEIGHT - PAD_BOTTOM}
              stroke={theme.colors.outlineVariant}
              strokeWidth={StyleSheet.hairlineWidth}
            />

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
                      rx={isCartoon ? deco.radius.sm : 3}
                      fill={fill}
                      opacity={selected ? 1 : completed ? 0.85 : 0.45}
                      stroke={selected ? theme.colors.onSurface : 'transparent'}
                      strokeWidth={selected ? 2 : 0}
                    />
                  );
                })
              : null}

            {multi
              ? series.map((s) => {
                  const pts = s.values
                    .map((v, i) => {
                      const x = colW * i + colW / 2;
                      const y = toY(v, yMax);
                      return `${x},${y}`;
                    })
                    .join(' ');
                  return (
                    <React.Fragment key={`line-${s.id}`}>
                      <Polyline
                        points={pts}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                      {s.values.map((v, i) => (
                        <Circle
                          key={`${s.id}-${days[i]?.date ?? i}`}
                          cx={colW * i + colW / 2}
                          cy={toY(v, yMax)}
                          r={days[i]?.date === selectedDate ? 4.5 : 3}
                          fill={s.color}
                        />
                      ))}
                    </React.Fragment>
                  );
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
                  <Text variant="labelSmall" style={styles.valueLabel}>
                    {value > 0 ? formatShort(value) : ''}
                  </Text>
                ) : (
                  <View style={styles.valueLabelSpacer} />
                )}
                <View style={{ flex: 1 }} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Day labels — subsample when dense */}
      <View style={styles.labelRow}>
        {days.map((day, i) => {
          const show =
            !dense || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0;
          return (
            <View key={`lbl-${day.date}`} style={styles.labelCol}>
              {show ? (
                <Text
                  variant="labelSmall"
                  style={[
                    styles.dayLabel,
                    day.date === selectedDate && styles.dayLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {day.label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {footer ? (
        <Text variant="bodySmall" style={styles.footer}>
          {footer}
        </Text>
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
    marginVertical: 4,
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
    height: 14,
    opacity: 0.7,
    fontSize: 9,
  },
  valueLabelSpacer: {
    height: 4,
  },
  labelRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  labelCol: {
    flex: 1,
    alignItems: 'center',
    minHeight: 14,
  },
  dayLabel: {
    fontSize: 9,
    opacity: 0.55,
    textAlign: 'center',
  },
  dayLabelSelected: {
    opacity: 1,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.6,
  },
});
