import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import HistoryRangeControl from '../components/history/HistoryRangeControl';
import HistoryStatRow from '../components/history/HistoryStatRow';
import { historyStats } from '../components/history/historyStats';
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
  CounterConfigSchema,
  countsAsScheduledDay,
  formatHabitTimerDuration,
  isElementDayComplete,
  parseHabitConfig,
  type ElementDefinition,
  type StreakUnit,
} from '../protocol';
import {
  DEFAULT_HISTORY_RANGE,
  MOVING_AVERAGE_WINDOW,
  computeActivityStats,
  computePersonalBestStreak,
  movingAverage,
  type HistoryRangeDays,
} from '../utils/chartStats';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { formatChartLabel, formatFullDate, lastNDates, streakHistorySinceDate } from '../utils/dates';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { playChartSelectHaptic } from '../utils/habitHaptics';
import { computeCounterStreaks } from '../utils/counterStreakCompute';
import {
  computeHabitStreaksFromEvents,
  habitDayHistoryFromEvents,
} from '../utils/habitStreakCompute';
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
  const { t } = useTranslation(['insights', 'common', 'trackers']);
  const { decorations: deco } = useAppTheme();
  const { elementId } = route.params;
  const [element, setElement] = useState<ElementDefinition | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [rangeDays, setRangeDays] = useState<HistoryRangeDays>(DEFAULT_HISTORY_RANGE);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [streakUnit, setStreakUnit] = useState<StreakUnit>('days');
  const [personalBest, setPersonalBest] = useState(0);
  /** Strength 0–100; null when the tracker has none (a counter without a target). */
  const [score, setScore] = useState<number | null>(null);
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
        setPersonalBest(0);
        setScore(null);
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
        const result = computeHabitStreaksFromEvents(yearRows, config, undefined, createdOn);
        setStreak(result.streak);
        setStreakUnit(result.streakUnit);
        setScore(result.score);
        const completed = completedDatesFromHabitEvents(yearRows, config);
        const history = habitDayHistoryFromEvents(yearRows, config);
        // A best run in days says nothing about a times-a-week habit; leave it out.
        setPersonalBest(
          config.schedule.type === 'times_per_week'
            ? 0
            : computePersonalBestStreak(completed, (date) =>
                countsAsScheduledDay(config.schedule, date, history),
              ),
        );
      } else {
        setStreak(0);
        setStreakUnit('days');
        setPersonalBest(0);
        const target = CounterConfigSchema.safeParse(loaded.config).data?.dailyTarget;
        if (target && target > 0) {
          const yearTotals = await eventRepo.getDailyTotalsByElement(
            db,
            elementId,
            streakHistorySinceDate(),
          );
          if (generation !== loadGenerationRef.current) return false;
          setScore(
            computeCounterStreaks(
              yearTotals,
              target,
              undefined,
              createdOnLocalDate(loaded.createdAt),
            ).score,
          );
        } else {
          setScore(null);
        }
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
          <Text style={[typeScale.body, styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
          <Button mode="text" onPress={() => void load()}>
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
          <QuietText style={typeScale.body}>{t('history.trackerNotFound')}</QuietText>
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

  const stats = chartModel.isHabit
    ? historyStats({
        kind: 'habit',
        daysDone: chartModel.completedFlags.filter(Boolean).length,
        streak,
        streakUnit,
        bestRun: personalBest,
        averageLabel:
          chartModel.isTimerHabit && chartModel.activity.activeDays > 0
            ? formatHabitTimerDuration(Math.round(chartModel.activity.averageActive * 60))
            : undefined,
      })
    : historyStats({
        kind: 'counter',
        bestValue: chartModel.activity.bestValue,
        average: chartModel.activity.averageActive,
        daysLogged: chartModel.activity.activeDays,
        unit: chartModel.chartUnit,
      });
  const tile = { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <HistoryRangeControl value={rangeDays} onChange={setRangeDays} />

        <View style={[styles.tile, tile]}>
          {score !== null ? (
            <View style={styles.strength}>
              <View
                style={styles.strengthFigure}
                accessible
                accessibilityLabel={t('trackers:habitWidget.strengthA11y', { score })}
              >
                <Text style={[typeScale.bigStat, { color: theme.colors.onSurface }]}>
                  {score}
                </Text>
                <QuietText style={typeScale.caption}>{t('history.statStrength')}</QuietText>
              </View>
              <QuietText style={typeScale.secondary}>{t('history.strengthExplainer')}</QuietText>
            </View>
          ) : null}
          <HistoryStatRow stats={stats} />
          <InteractiveDailyChart
            days={days.map((d) => ({ date: d.date, label: d.label }))}
            series={[
              {
                id: elementId,
                color: theme.colors.primary,
                values: chartModel.plotValues,
                completed: chartModel.completedFlags,
              },
            ]}
            selectedDate={selectedDate}
            onSelectDay={handleSelectDay}
            movingAverage={chartModel.ma}
            dense={rangeDays > 14}
            footer={t('history.chartFooter', { window: MOVING_AVERAGE_WINDOW })}
          />
        </View>

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
            android_ripple={{ color: theme.colors.surfaceVariant }}
            style={[styles.tile, tile]}
          >
            <View style={styles.dayPanelTop}>
              <Text style={[typeScale.rowName, styles.flexText, { color: theme.colors.onSurface }]}>
                {formatFullDate(selected.date)}
              </Text>
              <QuietText style={typeScale.data}>{selectedValueLabel}</QuietText>
            </View>
            <View style={styles.noteRow}>
              <MaterialCommunityIcons
                name={selectedNote ? 'note-text-outline' : 'note-plus-outline'}
                size={18}
                color={selectedNote ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <QuietText numberOfLines={2} style={[typeScale.secondary, styles.flexText]}>
                {selectedNote
                  ? truncateNotePreview(selectedNote, 120)
                  : t('history.tapToAddNote')}
              </QuietText>
            </View>
          </Pressable>
        ) : (
          <QuietText style={typeScale.secondary}>{t('history.tapDayHint')}</QuietText>
        )}
      </ScrollView>

      {editorHost}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.gutter,
  },
  errorText: {
    marginBottom: space.md,
    textAlign: 'center',
  },
  tile: {
    padding: layout.gutter,
    overflow: 'hidden',
  },
  dayPanelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.sm,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  strength: {
    gap: space.xs,
    marginBottom: space.lg,
  },
  strengthFigure: {
    alignSelf: 'flex-start',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
});
