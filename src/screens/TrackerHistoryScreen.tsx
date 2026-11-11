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
import { loadTrackerHistory } from '../store/trackerHistoryFetch';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import type { RootStackParamList } from '../navigation/types';
import {
  chartPlotValue,
  chartUnitLabel,
  formatHabitTimerDuration,
  parseHabitConfig,
  type DayFacts,
  type ElementDefinition,
} from '../protocol';
import {
  DEFAULT_HISTORY_RANGE,
  MOVING_AVERAGE_WINDOW,
  computeActivityStats,
  movingAverage,
  type HistoryRangeDays,
} from '../utils/chartStats';
import { formatChartLabel, formatFullDate, lastNDates } from '../utils/dates';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { playChartSelectHaptic } from '../utils/habitHaptics';
import {
  formatTrackerHistoryDayValue,
  truncateNotePreview,
} from '../utils/trackerHistoryFormat';

type Props = NativeStackScreenProps<RootStackParamList, 'TrackerHistory'>;

interface DayRow {
  date: string;
  facts: DayFacts;
  done: boolean;
  label: string;
}

export default function TrackerHistoryScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { t } = useTranslation(['insights', 'common']);
  const { decorations: deco } = useAppTheme();
  const { elementId } = route.params;
  const [element, setElement] = useState<ElementDefinition | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [rangeDays, setRangeDays] = useState<HistoryRangeDays>(DEFAULT_HISTORY_RANGE);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
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
        setPersonalBest(0);
        return true;
      }

      setElement(loaded);

      const range = lastNDates(rangeDays);
      const since = range[0]!;
      const history = await loadTrackerHistory(db, loaded, range);
      if (generation !== loadGenerationRef.current) return false;
      const notes = await dayNoteRepo.getNotesForElementInRange(db, elementId, since);
      if (generation !== loadGenerationRef.current) return false;
      setNotesByDate(new Map(notes.map((n) => [n.date, n.body])));

      setDays(history.days.map((day) => ({ ...day, label: formatChartLabel(day.date) })));
      setSelectedDate((prev) => {
        if (prev && range.includes(prev)) return prev;
        return range[range.length - 1] ?? null;
      });
      setStreak(history.streak);
      setPersonalBest(history.personalBest);
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

    const plotValues = days.map((d) => chartPlotValue(element, d.facts));
    const completedFlags = days.map((d) => d.done);
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
    ? formatTrackerHistoryDayValue(element, selected.facts)
    : '—';

  const stats = chartModel.isHabit
    ? historyStats({
        kind: 'habit',
        daysDone: chartModel.completedFlags.filter(Boolean).length,
        streak,
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
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
});
