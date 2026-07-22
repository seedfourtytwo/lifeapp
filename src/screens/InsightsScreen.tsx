import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Card,
  Chip,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { InteractiveDailyChart } from '../components/InteractiveDailyChart';
import { useAppTheme } from '../hooks/useAppTheme';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import {
  isHabitDayComplete,
  parseHabitConfig,
  type ElementDefinition,
} from '../protocol';
import {
  DEFAULT_HISTORY_RANGE,
  HISTORY_RANGES,
  INSIGHTS_MAX_SERIES,
  normalizeSeriesToUnit,
  type HistoryRangeDays,
} from '../utils/chartStats';
import { formatChartLabel, formatFullDate, lastNDates } from '../utils/dates';
import { playChartSelectHaptic } from '../utils/habitHaptics';
import { seriesColorAt } from '../utils/insightsColors';
import {
  formatTrackerHistoryDayValue,
  truncateNotePreview,
} from '../utils/trackerHistoryFormat';
import { formatTempC } from '../weather/format';
import { ensureWeatherDailyRange } from '../weather/ensureWeatherDailyRange';
import type { WeatherDailySnapshot } from '../weather/types';
import { conditionLabel } from '../weather/codes';

function toPlotValue(element: ElementDefinition, total: number): number {
  if (element.kind === 'habit') {
    const config = parseHabitConfig(element.config);
    if (config.trackingMode === 'timer') return Math.round(total / 60);
    return isHabitDayComplete(total, config) ? 1 : 0;
  }
  return total;
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('insights');
  const { decorations: deco, isCartoon } = useAppTheme();
  const [elements, setElements] = useState<ElementDefinition[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rangeDays, setRangeDays] = useState<HistoryRangeDays>(DEFAULT_HISTORY_RANGE);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [totalsByElement, setTotalsByElement] = useState<
    Map<string, Map<string, number>>
  >(new Map());
  const [weatherByDate, setWeatherByDate] = useState<Map<string, WeatherDailySnapshot>>(
    new Map(),
  );
  const [showWeather, setShowWeather] = useState(false);
  const [notesByElement, setNotesByElement] = useState<Map<string, string>>(new Map());
  const [journalBody, setJournalBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const noteEditor = useNoteEditorSession({
    onSaved: (date, body, target) => {
      if (selectedDateRef.current !== date) return;
      if (target.kind === 'journal') {
        setJournalBody(body);
        return;
      }
      setNotesByElement((prev) => {
        const next = new Map(prev);
        if (body == null || body.length === 0) next.delete(target.elementId);
        else next.set(target.elementId, body);
        return next;
      });
    },
  });
  const editingRef = useRef(false);
  editingRef.current = noteEditor.session != null;

  const dates = useMemo(() => lastNDates(rangeDays), [rangeDays]);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const all = await elementRepo.getAllElements(db);
      if (generation !== loadGenerationRef.current) return;
      const active = all.filter((e) => !e.archivedAt);
      setElements(active);

      setSelectedIds((prev) => {
        const stillValid = prev.filter((id) => active.some((e) => e.id === id));
        if (stillValid.length > 0) return stillValid;
        return active.slice(0, Math.min(2, active.length)).map((e) => e.id);
      });

      const since = dates[0]!;
      const until = dates[dates.length - 1]!;
      const ids = active.map((e) => e.id);
      const totalsMap = await eventRepo.getDailyTotalsForElementsSince(db, ids, since);
      if (generation !== loadGenerationRef.current) return;

      const byElement = new Map<string, Map<string, number>>();
      for (const id of ids) {
        const dayMap = new Map<string, number>();
        for (const row of totalsMap.get(id) ?? []) {
          dayMap.set(row.date, row.total);
        }
        byElement.set(id, dayMap);
      }
      setTotalsByElement(byElement);

      setSelectedDate((prev) => {
        if (prev && dates.includes(prev)) return prev;
        return until;
      });

      // Weather backfill is best-effort; do not block chart.
      void (async () => {
        try {
          const snaps = await ensureWeatherDailyRange(db, since, until);
          if (generation !== loadGenerationRef.current) return;
          setWeatherByDate(new Map(snaps.map((s) => [s.date, s])));
        } catch {
          // ignore
        }
      })();
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      setError(err instanceof Error ? err.message : t('screen.couldNotLoadFallback'));
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, [dates, t]);

  useFocusEffect(
    useCallback(() => {
      if (editingRef.current) return;
      void load();
    }, [load]),
  );

  // Load journal + tracker notes for the selected day (skip while a sheet is open).
  useEffect(() => {
    if (!selectedDate) {
      setJournalBody(null);
      setNotesByElement(new Map());
      return;
    }
    if (noteEditor.session != null) return;
    let cancelled = false;
    void (async () => {
      try {
        const db = await getDatabase();
        const journal = await dailyJournalRepo.getJournal(db, selectedDate);
        const notes =
          selectedIds.length > 0
            ? await dayNoteRepo.getNotesForElementsOnDate(db, selectedIds, selectedDate)
            : new Map();
        if (cancelled) return;
        setJournalBody(journal?.body ?? null);
        const map = new Map<string, string>();
        for (const [id, note] of notes) map.set(id, note.body);
        setNotesByElement(map);
      } catch {
        if (!cancelled) {
          setJournalBody(null);
          setNotesByElement(new Map());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedIds, noteEditor.session]);

  const toggleSeries = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= INSIGHTS_MAX_SERIES) return prev;
      return [...prev, id];
    });
  };

  const selectedElements = useMemo(
    () =>
      selectedIds
        .map((id) => elements.find((e) => e.id === id))
        .filter((e): e is ElementDefinition => e != null),
    [selectedIds, elements],
  );

  const chartSeries = useMemo(() => {
    const raw = selectedElements.map((el) =>
      dates.map((date) => toPlotValue(el, totalsByElement.get(el.id)?.get(date) ?? 0)),
    );
    const normalized = normalizeSeriesToUnit(raw);
    return selectedElements.map((el, i) => ({
      id: el.id,
      color: seriesColorAt(i),
      values: normalized[i] ?? [],
    }));
  }, [selectedElements, dates, totalsByElement]);

  const weatherOverlay = useMemo(() => {
    if (!showWeather) return undefined;
    return {
      values: dates.map((d) => weatherByDate.get(d)?.tempMaxC ?? null),
      color: theme.colors.outline,
    };
  }, [showWeather, dates, weatherByDate, theme.colors.outline]);

  const handleSelectDay = (date: string) => {
    setSelectedDate(date);
    void playChartSelectHaptic();
  };

  const openTrackerNote = (element: ElementDefinition, date: string) => {
    void noteEditor.open(
      { kind: 'tracker', elementId: element.id, label: element.name },
      date,
    );
  };

  const openJournal = (date: string) => {
    void noteEditor.open({ kind: 'journal' }, date);
  };

  const editorHost = <NoteEditorHost session={noteEditor} />;

  if (loading && elements.length === 0) {
    return (
      <>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
        {editorHost}
      </>
    );
  }

  if (error && elements.length === 0) {
    return (
      <>
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        </View>
        {editorHost}
      </>
    );
  }

  if (elements.length === 0) {
    return (
      <>
        <View style={styles.centered}>
          <Text variant="bodyLarge" style={styles.emptyTitle}>
            {t('screen.emptyTitle')}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyBody}>
            {t('screen.emptyBody')}
          </Text>
        </View>
        {editorHost}
      </>
    );
  }

  const weatherForDay = selectedDate ? weatherByDate.get(selectedDate) : undefined;
  const atCap = selectedIds.length >= INSIGHTS_MAX_SERIES;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.rangeRow}>
          {HISTORY_RANGES.map((n) => (
            <Chip
              key={n}
              compact
              selected={rangeDays === n}
              onPress={() => setRangeDays(n)}
            >
              {t('screen.dayRangeChip', { count: n })}
            </Chip>
          ))}
        </View>

        <Text variant="titleSmall" style={styles.sectionLabel}>
          {t('screen.trackersLabel')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          {elements.map((el) => {
            const selected = selectedIds.includes(el.id);
            const colorIndex = selectedIds.indexOf(el.id);
            return (
              <Chip
                key={el.id}
                compact
                selected={selected}
                onPress={() => toggleSeries(el.id)}
                style={[
                  styles.seriesChip,
                  selected && {
                    backgroundColor: seriesColorAt(colorIndex) + '22',
                  },
                ]}
                selectedColor={selected ? seriesColorAt(colorIndex) : undefined}
                icon={selected ? 'check' : undefined}
              >
                {el.name}
              </Chip>
            );
          })}
        </ScrollView>
        {atCap ? (
          <Text variant="bodySmall" style={styles.capHint}>
            {t('screen.capHint', { count: INSIGHTS_MAX_SERIES })}
          </Text>
        ) : null}

        <View style={styles.weatherRow}>
          <Text variant="bodyMedium">{t('screen.weatherLabel')}</Text>
          <Switch value={showWeather} onValueChange={setShowWeather} />
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
            <Text variant="titleMedium">{t('screen.compareTitle', { count: rangeDays })}</Text>
            {selectedElements.length === 0 ? (
              <Text variant="bodyMedium" style={styles.emptyChart}>
                {t('screen.tickToPlot')}
              </Text>
            ) : (
              <InteractiveDailyChart
                days={dates.map((date) => ({
                  date,
                  label: formatChartLabel(date),
                }))}
                series={chartSeries}
                selectedDate={selectedDate}
                onSelectDay={handleSelectDay}
                weatherOverlay={weatherOverlay}
                dense={rangeDays > 14}
                footer={t('screen.chartFooter')}
              />
            )}
          </Card.Content>
        </Card>

        {selectedDate ? (
          <View
            style={[
              styles.dayPanel,
              {
                borderColor: theme.colors.outlineVariant,
                borderWidth: isCartoon ? deco.borderWidth : StyleSheet.hairlineWidth,
                borderRadius: isCartoon ? deco.radius.md : 8,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text variant="titleSmall" style={styles.dayTitle}>
              {formatFullDate(selectedDate)}
            </Text>

            <Pressable
              onPress={() => openJournal(selectedDate)}
              accessibilityRole="button"
              accessibilityLabel={
                journalBody
                  ? t('screen.editJournalForA11y', { date: formatFullDate(selectedDate) })
                  : t('screen.addJournalForA11y', { date: formatFullDate(selectedDate) })
              }
              style={styles.journalRow}
            >
              <MaterialCommunityIcons
                name={journalBody ? 'notebook' : 'notebook-outline'}
                size={16}
                color={journalBody ? theme.colors.primary : theme.colors.onSurfaceVariant}
                style={styles.noteIcon}
              />
              <View style={styles.journalText}>
                <Text variant="labelMedium">{t('screen.journalLabel')}</Text>
                <Text
                  variant="bodySmall"
                  numberOfLines={2}
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {journalBody ? truncateNotePreview(journalBody, 120) : t('screen.addJournal')}
                </Text>
              </View>
            </Pressable>

            {selectedElements.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyChart}>
                {t('screen.tickToCompare')}
              </Text>
            ) : null}

            {selectedElements.map((el, i) => {
              const total = totalsByElement.get(el.id)?.get(selectedDate) ?? 0;
              const note = notesByElement.get(el.id);
              return (
                <View key={el.id} style={styles.seriesDayBlock}>
                  <View style={styles.seriesDayTop}>
                    <View style={styles.seriesNameRow}>
                      <View
                        style={[styles.swatch, { backgroundColor: seriesColorAt(i) }]}
                      />
                      <Text variant="bodyMedium" style={styles.seriesName}>
                        {el.name}
                      </Text>
                    </View>
                    <Text variant="bodyMedium" style={styles.seriesValue}>
                      {formatTrackerHistoryDayValue(el, total)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => openTrackerNote(el, selectedDate)}
                    accessibilityRole="button"
                    style={styles.noteRow}
                  >
                    <MaterialCommunityIcons
                      name={note ? 'note-text-outline' : 'note-plus-outline'}
                      size={14}
                      color={note ? theme.colors.primary : theme.colors.onSurfaceVariant}
                      style={styles.noteIcon}
                    />
                    <Text
                      variant="bodySmall"
                      numberOfLines={2}
                      style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
                    >
                      {note ? truncateNotePreview(note, 100) : t('screen.addNote')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}

            {showWeather ? (
              <View style={styles.weatherDay}>
                <MaterialCommunityIcons
                  name="weather-partly-cloudy"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                  style={styles.noteIcon}
                />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {weatherForDay
                    ? t('screen.highTempCondition', {
                        temp: formatTempC(weatherForDay.tempMaxC),
                        condition: conditionLabel(weatherForDay.condition),
                      }) +
                      (weatherForDay.precipProbabilityPct != null
                        ? t('screen.rainChanceSuffix', {
                            percent: weatherForDay.precipProbabilityPct,
                          })
                        : '')
                    : t('screen.noWeatherForDay')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {editorHost}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyBody: {
    opacity: 0.7,
    textAlign: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    marginBottom: 6,
    opacity: 0.8,
  },
  chipScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  seriesChip: {
    marginRight: 0,
  },
  capHint: {
    marginTop: 6,
    opacity: 0.65,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    marginBottom: 16,
  },
  emptyChart: {
    marginTop: 16,
    marginBottom: 8,
    opacity: 0.7,
  },
  dayPanel: {
    padding: 14,
  },
  dayTitle: {
    marginBottom: 10,
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000022',
  },
  journalText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  seriesDayBlock: {
    marginBottom: 12,
  },
  seriesDayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seriesNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 8,
  },
  seriesName: {
    flex: 1,
  },
  seriesValue: {
    fontWeight: '600',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  noteIcon: {
    marginRight: 4,
    marginTop: 1,
  },
  weatherDay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000022',
  },
});
