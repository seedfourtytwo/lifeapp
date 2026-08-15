import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Divider,
  SegmentedButtons,
  Surface,
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
import * as journalNotebookRepo from '../db/repositories/journalNotebookRepository';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import {
  isHabitDayComplete,
  parseHabitConfig,
  type ElementDefinition,
  type TrackerIconId,
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

function isHistoryRangeDays(value: number): value is HistoryRangeDays {
  return (HISTORY_RANGES as readonly number[]).includes(value);
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
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [defaultNotebookId, setDefaultNotebookId] = useState<string | null>(null);
  const [defaultNotebookName, setDefaultNotebookName] = useState<string | null>(null);
  const [defaultNotebookIcon, setDefaultNotebookIcon] = useState<TrackerIconId | undefined>(
    undefined,
  );
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
        setJournalEntryId(target.entryId ?? null);
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

  useEffect(() => {
    if (!selectedDate) {
      setJournalBody(null);
      setJournalEntryId(null);
      setNotesByElement(new Map());
      return;
    }
    if (noteEditor.session != null) return;
    let cancelled = false;
    void (async () => {
      try {
        const db = await getDatabase();
        const entries = await dailyJournalRepo.getJournalsForDate(db, selectedDate);
        const notebooks = await journalNotebookRepo.getAllNotebooks(db);
        const notes =
          selectedIds.length > 0
            ? await dayNoteRepo.getNotesForElementsOnDate(db, selectedIds, selectedDate)
            : new Map();
        if (cancelled) return;
        const latest = entries[0] ?? null;
        setJournalBody(latest?.body ?? null);
        setJournalEntryId(latest?.id ?? null);
        setDefaultNotebookId(notebooks[0]?.id ?? null);
        setDefaultNotebookName(notebooks[0]?.name ?? null);
        setDefaultNotebookIcon(notebooks[0]?.icon);
        const map = new Map<string, string>();
        for (const [id, note] of notes) map.set(id, note.body);
        setNotesByElement(map);
      } catch {
        if (!cancelled) {
          setJournalBody(null);
          setJournalEntryId(null);
          setDefaultNotebookId(null);
          setDefaultNotebookName(null);
          setDefaultNotebookIcon(undefined);
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
    if (!defaultNotebookId) return;
    void noteEditor.open(
      {
        kind: 'journal',
        notebookId: defaultNotebookId,
        entryId: journalEntryId ?? undefined,
        label: defaultNotebookName ?? undefined,
        icon: defaultNotebookIcon,
      },
      date,
    );
  };

  const editorHost = <NoteEditorHost session={noteEditor} />;
  const surfaceStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outlineVariant,
    borderRadius: deco.radius.md,
    borderWidth: isCartoon ? deco.cardBorderWidth : StyleSheet.hairlineWidth,
  };

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
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {t('screen.emptyTitle')}
          </Text>
          <Text variant="bodyMedium" style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>
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
        <SegmentedButtons
          value={String(rangeDays)}
          onValueChange={(value) => {
            const n = Number(value);
            if (isHistoryRangeDays(n)) setRangeDays(n);
          }}
          buttons={HISTORY_RANGES.map((n) => ({
            value: String(n),
            label: t('screen.dayRangeChip', { count: n }),
            accessibilityLabel: t('screen.dayRangeChip', { count: n }),
          }))}
        />

        <View style={styles.seriesBlock}>
          <View style={styles.seriesHeader}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('screen.trackersLabel')}
            </Text>
            {atCap ? (
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.8 }}>
                {t('screen.capHint', { count: INSIGHTS_MAX_SERIES })}
              </Text>
            ) : null}
          </View>
          <View style={styles.seriesWrap}>
            {elements.map((el) => {
              const selected = selectedIds.includes(el.id);
              const colorIndex = selectedIds.indexOf(el.id);
              const color = selected ? seriesColorAt(colorIndex) : theme.colors.onSurfaceVariant;
              const disabled = atCap && !selected;
              return (
                <Pressable
                  key={el.id}
                  onPress={() => toggleSeries(el.id)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={el.name}
                  style={({ pressed }) => [
                    styles.seriesChip,
                    {
                      backgroundColor: selected ? color + '22' : theme.colors.surfaceVariant,
                      borderColor: selected ? color : 'transparent',
                      borderRadius: isCartoon ? deco.radius.sm : 16,
                      borderWidth: selected ? (isCartoon ? deco.borderWidth : 1.5) : 0,
                      opacity: disabled ? 0.45 : 1,
                    },
                    pressed && !disabled && styles.pressed,
                  ]}
                >
                  {selected ? (
                    <View style={[styles.seriesDot, { backgroundColor: color }]} />
                  ) : null}
                  <Text
                    variant="labelLarge"
                    numberOfLines={1}
                    style={{ color: selected ? color : theme.colors.onSurface }}
                  >
                    {el.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => setShowWeather((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: showWeather }}
          style={styles.weatherToggle}
        >
          <MaterialCommunityIcons
            name="weather-partly-cloudy"
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="bodyMedium" style={styles.weatherLabel}>
            {t('screen.weatherLabel')}
          </Text>
          <View pointerEvents="none">
            <Switch value={showWeather} onValueChange={setShowWeather} accessible={false} />
          </View>
        </Pressable>

        <Surface style={[styles.chartCard, surfaceStyle]} elevation={0}>
          {selectedElements.length === 0 ? (
            <Text variant="bodyMedium" style={[styles.emptyChart, { color: theme.colors.onSurfaceVariant }]}>
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
            />
          )}
        </Surface>

        {selectedDate ? (
          <Surface style={[styles.dayPanel, surfaceStyle]} elevation={0}>
            <Text variant="titleMedium">{formatFullDate(selectedDate)}</Text>

            <Pressable
              onPress={() => openJournal(selectedDate)}
              disabled={!defaultNotebookId}
              accessibilityRole="button"
              accessibilityState={{ disabled: !defaultNotebookId }}
              accessibilityLabel={
                journalBody
                  ? t('screen.editJournalForA11y', { date: formatFullDate(selectedDate) })
                  : t('screen.addJournalForA11y', { date: formatFullDate(selectedDate) })
              }
              style={({ pressed }) => [
                styles.journalRow,
                !defaultNotebookId && styles.disabledRow,
                pressed && defaultNotebookId ? styles.pressed : null,
              ]}
            >
              <MaterialCommunityIcons
                name={journalBody ? 'notebook' : 'notebook-outline'}
                size={20}
                color={journalBody ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <View style={styles.flexText}>
                <Text variant="labelLarge">{t('screen.journalLabel')}</Text>
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
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.75 }}>
                {t('screen.tickToCompare')}
              </Text>
            ) : (
              selectedElements.map((el, i) => {
                const total = totalsByElement.get(el.id)?.get(selectedDate) ?? 0;
                const note = notesByElement.get(el.id);
                return (
                  <View key={el.id}>
                    <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                    <View style={styles.seriesDayTop}>
                      <View style={styles.seriesNameRow}>
                        <View style={[styles.swatch, { backgroundColor: seriesColorAt(i) }]} />
                        <Text variant="bodyMedium" style={styles.flexText} numberOfLines={1}>
                          {el.name}
                        </Text>
                      </View>
                      <Text variant="titleSmall">{formatTrackerHistoryDayValue(el, total)}</Text>
                    </View>
                    <Pressable
                      onPress={() => openTrackerNote(el, selectedDate)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.noteRow, pressed && styles.pressed]}
                    >
                      <MaterialCommunityIcons
                        name={note ? 'note-text-outline' : 'note-plus-outline'}
                        size={16}
                        color={note ? theme.colors.primary : theme.colors.onSurfaceVariant}
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
              })
            )}

            {showWeather ? (
              <>
                <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
                <View style={styles.weatherDay}>
                  <MaterialCommunityIcons
                    name="weather-partly-cloudy"
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
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
              </>
            ) : null}
          </Surface>
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
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontWeight: '600',
  },
  emptyBody: {
    textAlign: 'center',
    opacity: 0.85,
  },
  seriesBlock: {
    gap: 8,
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 4,
  },
  seriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seriesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  seriesDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  weatherToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  weatherLabel: {
    flex: 1,
  },
  chartCard: {
    padding: 12,
    overflow: 'hidden',
  },
  emptyChart: {
    paddingVertical: 24,
    textAlign: 'center',
    opacity: 0.8,
  },
  dayPanel: {
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  seriesDayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  seriesNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 8,
  },
  weatherDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  disabledRow: {
    opacity: 0.45,
  },
});
