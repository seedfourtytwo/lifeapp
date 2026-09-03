import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { InteractiveDailyChart } from '../components/InteractiveDailyChart';
import { useAppTheme } from '../hooks/useAppTheme';
import { getDatabase } from '../db/client';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import type { RootStackParamList } from '../navigation/types';
import {
  chartPlotValue,
  chartUnitLabel,
  completedDatesFromHabitEvents,
  formatHabitTimerDuration,
  isElementDayComplete,
  isHabitScheduledOnDate,
  parseHabitConfig,
  type ElementDefinition,
} from '../protocol';
import {
  DEFAULT_HISTORY_RANGE,
  HISTORY_RANGES,
  MOVING_AVERAGE_WINDOW,
  computeActivityStats,
  computePersonalBestStreak,
  movingAverage,
  type HistoryRangeDays,
} from '../utils/chartStats';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { formatChartLabel, formatFullDate, lastNDates, streakHistorySinceDate } from '../utils/dates';
import { playChartSelectHaptic } from '../utils/habitHaptics';
import { computeHabitStreaksFromEvents } from '../utils/habitStreakCompute';
import {
  formatTrackerHistoryDayValue,
  truncateNotePreview,
} from '../utils/trackerHistoryFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'TrackerHistory'>;

interface DayRow {
  date: string;
  total: number;
  label: string;
}

export default function TrackerHistoryScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { t } = useTranslation(['insights', 'common']);
  const { decorations: deco, isCartoon } = useAppTheme();
  const { elementId } = route.params;
  const [element, setElement] = useState<ElementDefinition | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [rangeDays, setRangeDays] = useState<HistoryRangeDays>(DEFAULT_HISTORY_RANGE);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [failureStreak, setFailureStreak] = useState(0);
  const [personalBest, setPersonalBest] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesByDate, setNotesByDate] = useState<Map<string, string>>(new Map());
  const loadGenerationRef = useRef(0);
  const noteEditor = useNoteEditorSession({
    onSaved: (date, body) => {
      setNotesByDate((prev) => {
        const next = new Map(prev);
        if (body == null || body.length === 0) next.delete(date);
        else next.set(date, body);
        return next;
      });
      void load({ silent: true });
    },
  });
  const editingDateRef = useRef<string | null>(null);
  editingDateRef.current = noteEditor.session?.date ?? null;

  const load = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    const generation = ++loadGenerationRef.current;
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const db = await getDatabase();
      const loaded = await elementRepo.getElementById(db, elementId);
      if (generation !== loadGenerationRef.current) return false;
      if (!loaded) {
        setElement(null);
        setDays([]);
        setNotesByDate(new Map());
        setStreak(0);
        setFailureStreak(0);
        setPersonalBest(0);
        return true;
      }

      setElement(loaded);

      const range = lastNDates(rangeDays);
      const since = range[0]!;
      const rows = await eventRepo.getDailyTotalsByElement(db, elementId, since);
      if (generation !== loadGenerationRef.current) return false;
      const notes = await dayNoteRepo.getNotesForElementInRange(db, elementId, since);
      if (generation !== loadGenerationRef.current) return false;
      const byDate = new Map(rows.map((r) => [r.date, r.total]));
      const noteByDate = new Map(notes.map((n) => [n.date, n.body]));
      setNotesByDate(noteByDate);

      const nextDays = range.map((date) => ({
        date,
        total: byDate.get(date) ?? 0,
        label: formatChartLabel(date),
      }));
      setDays(nextDays);
      setSelectedDate((prev) => {
        if (prev && range.includes(prev)) return prev;
        return range[range.length - 1] ?? null;
      });

      if (loaded.kind === 'habit') {
        const config = parseHabitConfig(loaded.config);
        const yearRows = await eventRepo.getEventsForElementSince(
          db,
          elementId,
          streakHistorySinceDate(),
        );
        if (generation !== loadGenerationRef.current) return false;
        const createdOn = createdOnLocalDate(loaded.createdAt);
        const { streak: currentStreak, failureStreak: currentFailureStreak } =
          computeHabitStreaksFromEvents(yearRows, config, undefined, createdOn);
        setStreak(currentStreak);
        setFailureStreak(currentFailureStreak);
        const completed = completedDatesFromHabitEvents(yearRows, config);
        setPersonalBest(
          computePersonalBestStreak(completed, (date) => isHabitScheduledOnDate(config, date)),
        );
      } else {
        setStreak(0);
        setFailureStreak(0);
        setPersonalBest(0);
      }
      return true;
    } catch (err) {
      if (generation !== loadGenerationRef.current) return false;
      if (!silent) {
        setError(err instanceof Error ? err.message : t('history.couldNotLoadFallback'));
      }
      return false;
    } finally {
      if (generation === loadGenerationRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [elementId, rangeDays, t]);

  const wasEditingRef = useRef(false);
  useEffect(() => {
    const open = noteEditor.session != null;
    if (wasEditingRef.current && !open) {
      void load({ silent: true });
    }
    wasEditingRef.current = open;
  }, [noteEditor.session, load]);

  useFocusEffect(
    useCallback(() => {
      if (editingDateRef.current) return;
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    if (element?.name) {
      navigation.setOptions({ title: element.name });
    }
  }, [element?.name, navigation]);

  const openNoteForDate = (date: string) => {
    if (!element) return;
    void noteEditor.open(
      { kind: 'tracker', elementId, label: element.name },
      date,
    );
  };

  const handleSelectDay = (date: string) => {
    setSelectedDate(date);
    void playChartSelectHaptic();
  };

  const chartModel = useMemo(() => {
    if (!element) return null;
    const isHabit = element.kind === 'habit';
    const habitConfig = isHabit ? parseHabitConfig(element.config) : null;
    const isTimerHabit = habitConfig?.trackingMode === 'timer';

    const plotValues = days.map((d) => chartPlotValue(element, d.total));
    const completedFlags = days.map((d) => isElementDayComplete(element, d.total));
    const chartUnit = chartUnitLabel(element);

    const activity = computeActivityStats(
      days.map((d) => d.date),
      plotValues,
    );

    return {
      isHabit,
      isTimerHabit,
      habitConfig,
      chartUnit,
      plotValues,
      completedFlags,
      activity,
      ma: movingAverage(plotValues, MOVING_AVERAGE_WINDOW),
    };
  }, [element, days]);

  const editorHost = <NoteEditorHost session={noteEditor} />;

  if (loading) {
    return (
      <>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
        {editorHost}
      </>
    );
  }

  if (error && !element) {
    return (
      <>
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ color: theme.colors.error, marginBottom: 12 }}>
            {error}
          </Text>
          <Button mode="outlined" onPress={() => void load()}>
            {t('common:actions.retry')}
          </Button>
        </View>
        {editorHost}
      </>
    );
  }

  if (!element || !chartModel) {
    return (
      <>
        <View style={styles.centered}>
          <Text variant="bodyLarge">{t('history.trackerNotFound')}</Text>
        </View>
        {editorHost}
      </>
    );
  }

  const selected = days.find((d) => d.date === selectedDate) ?? null;
  const selectedNote = selectedDate ? notesByDate.get(selectedDate) : undefined;
  const selectedValueLabel = selected
    ? formatTrackerHistoryDayValue(element, selected.total)
    : '—';

  let metricLine: string | null = null;
  if (chartModel.isHabit) {
    const streakBits = [
      streak > 0 ? t('history.streakLabel', { count: streak }) : null,
      failureStreak > 0 ? t('history.missedLabel', { count: failureStreak }) : null,
      personalBest > 0 ? t('history.bestLabel', { count: personalBest }) : null,
    ].filter(Boolean);
    if (chartModel.isTimerHabit && chartModel.activity.activeDays > 0) {
      const bestDay = days.find((d) => d.date === chartModel.activity.bestDate);
      if (bestDay) {
        streakBits.push(
          t('history.topLabel', { duration: formatHabitTimerDuration(bestDay.total) }),
        );
      }
      streakBits.push(
        t('history.avgLabel', {
          duration: formatHabitTimerDuration(Math.round(chartModel.activity.averageActive * 60)),
        }),
      );
    }
    metricLine = streakBits.length > 0 ? streakBits.join(' · ') : null;
  } else if (chartModel.activity.activeDays > 0) {
    const bestDay = days.find((d) => d.date === chartModel.activity.bestDate);
    metricLine = [
      bestDay
        ? t('history.bestValueLabel', {
            value: formatTrackerHistoryDayValue(element, bestDay.total),
          })
        : null,
      t('history.avgValueLabel', {
        value: Math.round(chartModel.activity.averageActive * 10) / 10,
        unit: chartModel.chartUnit,
      }),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {metricLine ? (
          <QuietText variant="bodyMedium" style={styles.metrics}>
            {metricLine}
          </QuietText>
        ) : null}

        <View style={styles.rangeRow}>
          {HISTORY_RANGES.map((n) => (
            <Chip
              key={n}
              compact
              selected={rangeDays === n}
              onPress={() => setRangeDays(n)}
              style={styles.rangeChip}
            >
              {t('history.dayRangeChip', { count: n })}
            </Chip>
          ))}
        </View>

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
            <Text variant="titleMedium">{t('history.lastNDays', { count: rangeDays })}</Text>
            <InteractiveDailyChart
              days={days.map((d) => ({ date: d.date, label: d.label }))}
              series={[
                {
                  id: elementId,
                  color: isCartoon ? theme.colors.secondary : theme.colors.primary,
                  values: chartModel.plotValues,
                  completed: chartModel.completedFlags,
                },
              ]}
              selectedDate={selectedDate}
              onSelectDay={handleSelectDay}
              movingAverage={chartModel.ma}
              dense={rangeDays > 14}
              footer={t('history.chartFooter', {
                unit: chartModel.chartUnit,
                window: MOVING_AVERAGE_WINDOW,
              })}
            />
          </Card.Content>
        </Card>

        {selected ? (
          <Pressable
            onPress={() => openNoteForDate(selected.date)}
            accessibilityRole="button"
            accessibilityLabel={
              selectedNote
                ? t('history.editNoteForA11y', {
                    date: formatFullDate(selected.date),
                    value: selectedValueLabel,
                  })
                : t('history.addNoteForA11y', {
                    date: formatFullDate(selected.date),
                    value: selectedValueLabel,
                  })
            }
            android_ripple={{ color: theme.colors.primaryContainer }}
            style={[
              styles.dayPanel,
              {
                borderColor: theme.colors.outlineVariant,
                borderWidth: deco.borderWidth,
                borderRadius: isCartoon ? deco.radius.md : 8,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View style={styles.dayPanelTop}>
              <Text variant="titleSmall">{formatFullDate(selected.date)}</Text>
              <Text variant="titleSmall" style={styles.dayPanelValue}>
                {selectedValueLabel}
              </Text>
            </View>
            <View style={styles.noteRow}>
              <MaterialCommunityIcons
                name={selectedNote ? 'note-text-outline' : 'note-plus-outline'}
                size={16}
                color={selectedNote ? theme.colors.primary : theme.colors.onSurfaceVariant}
                style={styles.noteIcon}
              />
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
              >
                {selectedNote
                  ? truncateNotePreview(selectedNote, 120)
                  : t('history.tapToAddNote')}
              </Text>
            </View>
          </Pressable>
        ) : (
          <QuietText variant="bodySmall" style={styles.emptyHint}>
            {t('history.tapDayHint')}
          </QuietText>
        )}
      </ScrollView>

      {editorHost}
    </>
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
  metrics: {
    marginBottom: 12,
    fontWeight: '600',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  rangeChip: {
    marginRight: 0,
  },
  card: {
    marginBottom: 16,
  },
  dayPanel: {
    padding: 14,
  },
  dayPanelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayPanelValue: {
    fontWeight: '700',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noteIcon: {
    marginRight: 6,
    marginTop: 1,
  },
  emptyHint: {},
});
