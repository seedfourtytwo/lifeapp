import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { DailyBarChart } from '../components/DailyBarChart';
import { useAppTheme } from '../hooks/useAppTheme';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import type { RootStackParamList } from '../navigation/types';
import {
  CounterConfigSchema,
  formatHabitTimerDuration,
  isHabitDayComplete,
  parseHabitConfig,
  type ElementDefinition,
} from '../protocol';
import { formatChartLabel, formatFullDate, lastNDates, streakHistorySinceDate } from '../utils/dates';
import { computeHabitStreaksFromEvents } from '../utils/habitStreakCompute';

const CHART_DAYS = 14;

type Props = NativeStackScreenProps<RootStackParamList, 'TrackerHistory'>;

interface DayRow {
  date: string;
  total: number;
  label: string;
}

function formatDayValue(
  element: ElementDefinition | null,
  total: number,
): string {
  if (!element) return String(total);

  if (element.kind === 'habit') {
    const config = parseHabitConfig(element.config);
    if (config.trackingMode === 'timer') {
      return total > 0 ? formatHabitTimerDuration(total) : '—';
    }
    return isHabitDayComplete(total, config) ? 'Done' : '—';
  }

  const unit = CounterConfigSchema.parse(element.config).unit;
  return `${total} ${unit}`;
}

export default function TrackerHistoryScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const { elementId } = route.params;
  const [element, setElement] = useState<ElementDefinition | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [streak, setStreak] = useState(0);
  const [failureStreak, setFailureStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const loaded = await elementRepo.getElementById(db, elementId);
      if (!loaded) {
        setElement(null);
        setDays([]);
        setStreak(0);
        setFailureStreak(0);
        return;
      }

      setElement(loaded);

      const range = lastNDates(CHART_DAYS);
      const since = range[0];
      const rows = await eventRepo.getDailyTotalsByElement(db, elementId, since);
      const byDate = new Map(rows.map((r) => [r.date, r.total]));

      setDays(
        range.map((date) => ({
          date,
          total: byDate.get(date) ?? 0,
          label: formatChartLabel(date),
        })),
      );

      if (loaded.kind === 'habit') {
        const config = parseHabitConfig(loaded.config);
        const yearRows = await eventRepo.getEventsForElementSince(
          db,
          elementId,
          streakHistorySinceDate(),
        );
        const { streak: currentStreak, failureStreak: currentFailureStreak } =
          computeHabitStreaksFromEvents(
            yearRows,
            config,
            undefined,
            loaded.createdAt?.slice(0, 10) ?? null,
          );
        setStreak(currentStreak);
        setFailureStreak(currentFailureStreak);
      } else {
        setStreak(0);
        setFailureStreak(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history');
    } finally {
      setLoading(false);
    }
  }, [elementId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    if (element?.name) {
      navigation.setOptions({ title: element.name });
    }
  }, [element?.name, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge" style={{ color: theme.colors.error, marginBottom: 12 }}>
          {error}
        </Text>
        <Button mode="outlined" onPress={() => void load()}>
          Retry
        </Button>
      </View>
    );
  }

  if (!element) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge">Tracker not found.</Text>
      </View>
    );
  }

  const isHabit = element.kind === 'habit';
  const habitConfig = isHabit ? parseHabitConfig(element.config) : null;
  const isTimerHabit = habitConfig?.trackingMode === 'timer';
  const chartUnit = isHabit
    ? isTimerHabit
      ? 'min'
      : 'done'
    : CounterConfigSchema.parse(element.config).unit;

  const chartData = days.map((d) => ({
    label: d.label,
    value: isTimerHabit ? Math.round(d.total / 60) : d.total,
  }));

  const completedDays = days.filter((d) =>
    isHabit && habitConfig
      ? isHabitDayComplete(d.total, habitConfig)
      : d.total > 0,
  );
  const best = completedDays.reduce<DayRow | null>(
    (max, d) => (!max || d.total > max.total ? d : max),
    null,
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isHabit && streak > 0 ? (
        <Text variant="bodyMedium" style={styles.streak}>
          Current streak: {streak} day{streak === 1 ? '' : 's'}
        </Text>
      ) : null}
      {isHabit && failureStreak > 0 ? (
        <Text variant="bodyMedium" style={styles.failureStreak}>
          Missed streak: {failureStreak} day{failureStreak === 1 ? '' : 's'}
        </Text>
      ) : null}

      <Card
        style={[
          styles.card,
          isCartoon && {
            borderWidth: deco.cardBorderWidth,
            borderColor: theme.colors.outline,
            borderRadius: deco.radius.md,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Card.Content>
          <Text variant="titleMedium">Last {CHART_DAYS} days</Text>
          <DailyBarChart data={chartData} unit={chartUnit} />
          {best && (isHabit ? isHabitDayComplete(best.total, habitConfig!) : best.total > 0) ? (
            <Text variant="bodySmall" style={styles.hint}>
              {isHabit && !isTimerHabit
                ? `Last completed: ${formatFullDate(best.date)}`
                : isTimerHabit
                  ? `Best day: ${formatHabitTimerDuration(best.total)} on ${formatFullDate(best.date)}`
                  : `Best day: ${formatDayValue(element, best.total)} on ${formatFullDate(best.date)}`}
            </Text>
          ) : (
            <Text variant="bodySmall" style={styles.hint}>
              {isHabit ? 'No completions yet — check in from the Habits tab.' : 'No data yet — log from the Counters tab.'}
            </Text>
          )}
        </Card.Content>
      </Card>

      <Text variant="titleSmall" style={styles.listTitle}>
        Daily breakdown
      </Text>
      {days
        .slice()
        .reverse()
        .map((day) => (
          <View
            key={day.date}
            style={[
              styles.row,
              {
                borderBottomColor: theme.colors.outlineVariant,
                borderBottomWidth: isCartoon ? deco.borderWidth : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text variant="bodyMedium">{formatFullDate(day.date)}</Text>
            <Text variant="bodyMedium" style={styles.rowTotal}>
              {formatDayValue(element, day.total)}
            </Text>
          </View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streak: {
    marginBottom: 12,
    opacity: 0.8,
    fontWeight: '600',
  },
  failureStreak: {
    marginBottom: 12,
    opacity: 0.85,
    fontWeight: '600',
    color: '#B3261E',
  },
  card: {
    marginBottom: 16,
  },
  hint: {
    marginTop: 8,
    opacity: 0.7,
  },
  listTitle: {
    marginBottom: 8,
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowTotal: {
    fontWeight: '600',
  },
});
