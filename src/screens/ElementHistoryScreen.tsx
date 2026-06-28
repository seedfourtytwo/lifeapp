import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { DailyBarChart } from '../components/DailyBarChart';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import type { RootStackParamList } from '../navigation/types';
import { CounterConfigSchema } from '../protocol';
import { formatChartLabel, formatFullDate, lastNDates } from '../utils/dates';

const CHART_DAYS = 14;

type Props = NativeStackScreenProps<RootStackParamList, 'ElementHistory'>;

interface DayRow {
  date: string;
  total: number;
  label: string;
}

export default function ElementHistoryScreen({ route, navigation }: Props) {
  const { elementId } = route.params;
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('reps');
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const element = await elementRepo.getElementById(db, elementId);
      if (!element) {
        setName('Unknown');
        setDays([]);
        return;
      }

      setName(element.name);
      if (element.kind === 'counter') {
        setUnit(CounterConfigSchema.parse(element.config).unit);
      }

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
    if (name) {
      navigation.setOptions({ title: name });
    }
  }, [name, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const chartData = days.map((d) => ({ label: d.label, value: d.total }));
  const best = days.reduce((max, d) => (d.total > max.total ? d : max), days[0]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Last {CHART_DAYS} days</Text>
          <DailyBarChart data={chartData} unit={unit} />
          {best && best.total > 0 ? (
            <Text variant="bodySmall" style={styles.hint}>
              Best day: {best.total} {unit} on {formatFullDate(best.date)}
            </Text>
          ) : (
            <Text variant="bodySmall" style={styles.hint}>
              No data yet — log reps from the dashboard.
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
          <View key={day.date} style={styles.row}>
            <Text variant="bodyMedium">{formatFullDate(day.date)}</Text>
            <Text variant="bodyMedium" style={styles.rowTotal}>
              {day.total} {unit}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  rowTotal: {
    fontWeight: '600',
  },
});
