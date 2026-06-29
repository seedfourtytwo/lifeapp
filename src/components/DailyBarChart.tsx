import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';

export interface DailyBarChartDatum {
  label: string;
  value: number;
}

interface DailyBarChartProps {
  data: DailyBarChartDatum[];
  unit: string;
}

const CHART_HEIGHT = 160;

export function DailyBarChart({ data, unit }: DailyBarChartProps) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const barColor = isCartoon ? theme.colors.secondary : theme.colors.primary;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.wrapper}>
      <View style={styles.chart}>
        {data.map((datum) => {
          const height = datum.value === 0 ? 2 : (datum.value / max) * CHART_HEIGHT;
          return (
            <View key={datum.label} style={styles.column}>
              <Text variant="labelSmall" style={styles.valueLabel}>
                {datum.value > 0 ? datum.value : ''}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: barColor,
                      borderTopLeftRadius: isCartoon ? deco.radius.sm : 4,
                      borderTopRightRadius: isCartoon ? deco.radius.sm : 4,
                      borderWidth: isCartoon ? deco.borderWidth : 0,
                      borderColor: theme.colors.outline,
                      borderBottomWidth: 0,
                    },
                  ]}
                />
              </View>
              <Text variant="labelSmall" style={styles.dayLabel} numberOfLines={1}>
                {datum.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="bodySmall" style={styles.unit}>
        Daily total ({unit})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT + 48,
    paddingHorizontal: 4,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 1,
  },
  valueLabel: {
    height: 16,
    opacity: 0.7,
    fontSize: 10,
  },
  barTrack: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    minHeight: 2,
  },
  dayLabel: {
    marginTop: 4,
    fontSize: 9,
    opacity: 0.6,
    textAlign: 'center',
  },
  unit: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.6,
  },
});
