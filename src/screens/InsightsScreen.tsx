import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';
import { InteractiveDailyChart } from '../components/InteractiveDailyChart';
import QuietText from '../components/QuietText';
import HistoryRangeControl from '../components/history/HistoryRangeControl';
import SeriesChip from '../components/history/SeriesChip';
import { SettingsSwitch } from '../components/settings';
import { useAppTheme } from '../hooks/useAppTheme';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
import * as elementRepo from '../db/repositories/elementRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import { useJournalNotebookStore } from '../store/journalNotebookStore';
import {
  chartPlotValue,
  chartUnitLabel,
  type ElementDefinition,
  type TrackerIconId,
} from '../protocol';
import {
  DEFAULT_HISTORY_RANGE,
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
import Rule from '../components/Rule';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

export default function InsightsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('insights');
  const { decorations: deco, themeMode } = useAppTheme();
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
        await useJournalNotebookStore.getState().load();
        const notebooks = useJournalNotebookStore.getState().notebooks;
        // One notebook drives this panel — the same one the row opens. Read the
        // whole day (every chapter joined), not one row: since v22 a notebook
        // day holds several, and showing only the first hid the rest silently.
        const notebookId = notebooks[0]?.id ?? null;
        const dayBody = notebookId
          ? await dailyJournalRepo.getJournalDayBody(db, notebookId, selectedDate)
          : '';
        const firstChapter = notebookId
          ? await dailyJournalRepo.getFirstJournalChapter(db, notebookId, selectedDate)
          : null;
        const notes =
          selectedIds.length > 0
            ? await dayNoteRepo.getNotesForElementsOnDate(db, selectedIds, selectedDate)
            : new Map();
        if (cancelled) return;
        setJournalBody(dayBody.trim().length > 0 ? dayBody : null);
        setJournalEntryId(firstChapter?.id ?? null);
        setDefaultNotebookId(notebookId);
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
      dates.map((date) => chartPlotValue(el, totalsByElement.get(el.id)?.get(date) ?? 0)),
    );
    const normalized = normalizeSeriesToUnit(raw);
    return selectedElements.map((el, i) => ({
      id: el.id,
      color: seriesColorAt(themeMode, i),
      values: normalized[i] ?? [],
      binary: el.kind === 'habit' && chartUnitLabel(el) === 'done',
    }));
  }, [selectedElements, dates, totalsByElement, themeMode]);

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
  // A tile stands off the page by fill alone.
  const tile = { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg };

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
          <Text style={[typeScale.body, { color: theme.colors.error }]}>{error}</Text>
        </View>
        {editorHost}
      </>
    );
  }

  if (elements.length === 0) {
    return (
      <>
        <View style={styles.container}>
          <EmptyState message={t('screen.emptyBody')} />
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
        <HistoryRangeControl value={rangeDays} onChange={setRangeDays} />

        <View style={styles.seriesBlock}>
          <View style={styles.seriesHeader}>
            <QuietText style={typeScale.meta}>{t('screen.trackersLabel')}</QuietText>
            {atCap ? (
              <QuietText style={typeScale.caption}>
                {t('screen.capHint', { count: INSIGHTS_MAX_SERIES })}
              </QuietText>
            ) : null}
          </View>
          <View style={styles.seriesWrap}>
            {elements.map((el) => {
              const selected = selectedIds.includes(el.id);
              return (
                <SeriesChip
                  key={el.id}
                  label={el.name}
                  selected={selected}
                  color={selected ? seriesColorAt(themeMode, selectedIds.indexOf(el.id)) : undefined}
                  disabled={atCap && !selected}
                  onPress={() => toggleSeries(el.id)}
                />
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => setShowWeather((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: showWeather }}
          style={[styles.weatherToggle, tile]}
        >
          <MaterialCommunityIcons
            name="weather-partly-cloudy"
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={[typeScale.body, styles.flexText, { color: theme.colors.onSurface }]}>
            {t('screen.weatherLabel')}
          </Text>
          <View pointerEvents="none">
            <SettingsSwitch value={showWeather} accessible={false} />
          </View>
        </Pressable>

        <View style={[styles.tile, tile]}>
          {selectedElements.length === 0 ? (
            <QuietText style={[typeScale.secondary, styles.emptyChart]}>
              {t('screen.tickToPlot')}
            </QuietText>
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
        </View>

        {selectedDate ? (
          <View style={[styles.tile, styles.dayPanel, tile]}>
            <Text style={[typeScale.rowName, { color: theme.colors.onSurface }]}>
              {formatFullDate(selectedDate)}
            </Text>

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
                name="notebook-outline"
                size={22}
                color={journalBody ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <View style={styles.flexText}>
                <Text style={[typeScale.body, { color: theme.colors.onSurface }]}>
                  {t('screen.journalLabel')}
                </Text>
                <QuietText numberOfLines={2} style={typeScale.secondary}>
                  {journalBody ? truncateNotePreview(journalBody, 120) : t('screen.addJournal')}
                </QuietText>
              </View>
            </Pressable>

            {selectedElements.length === 0 ? (
              <QuietText style={typeScale.secondary}>{t('screen.tickToCompare')}</QuietText>
            ) : (
              selectedElements.map((el, i) => {
                const total = totalsByElement.get(el.id)?.get(selectedDate) ?? 0;
                const note = notesByElement.get(el.id);
                return (
                  <View key={el.id}>
                    <Rule />
                    <View style={styles.seriesDayTop}>
                      <View style={styles.seriesNameRow}>
                        <View
                          style={[styles.swatch, { backgroundColor: seriesColorAt(themeMode, i) }]}
                        />
                        <Text
                          style={[typeScale.body, styles.flexText, { color: theme.colors.onSurface }]}
                          numberOfLines={1}
                        >
                          {el.name}
                        </Text>
                      </View>
                      <QuietText style={typeScale.data}>
                        {formatTrackerHistoryDayValue(el, total)}
                      </QuietText>
                    </View>
                    <Pressable
                      onPress={() => openTrackerNote(el, selectedDate)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.noteRow, pressed && styles.pressed]}
                    >
                      <MaterialCommunityIcons
                        name={note ? 'note-text-outline' : 'note-plus-outline'}
                        size={18}
                        color={note ? theme.colors.primary : theme.colors.onSurfaceVariant}
                      />
                      <QuietText numberOfLines={2} style={[typeScale.secondary, styles.flexText]}>
                        {note ? truncateNotePreview(note, 100) : t('screen.addNote')}
                      </QuietText>
                    </Pressable>
                  </View>
                );
              })
            )}

            {showWeather ? (
              <>
                <Rule />
                <View style={styles.weatherDay}>
                  <MaterialCommunityIcons
                    name="weather-partly-cloudy"
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <QuietText style={[typeScale.secondary, styles.flexText]}>
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
                  </QuietText>
                </View>
              </>
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
  seriesBlock: {
    gap: space.sm,
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  seriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  weatherToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: layout.gutter,
  },
  tile: {
    padding: layout.gutter,
    overflow: 'hidden',
  },
  emptyChart: {
    paddingVertical: space.xl,
    textAlign: 'center',
  },
  dayPanel: {
    gap: space.md,
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.xs,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  seriesDayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.md,
  },
  seriesNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: space.sm,
    minWidth: 0,
  },
  swatch: {
    width: 10,
    height: 10,
    // Geometric: half the size is what makes it round.
    borderRadius: 5,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  weatherDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  disabledRow: {
    opacity: 0.45,
  },
});
