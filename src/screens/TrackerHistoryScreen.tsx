import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { DailyBarChart } from '../components/DailyBarChart';
import DayNoteEditorSheet from '../components/DayNoteEditorSheet';
import { useAppTheme } from '../hooks/useAppTheme';
import { getDatabase } from '../db/client';
import { withDbWriteLock } from '../db/writeLock';
import * as dayNoteRepo from '../db/repositories/dayNoteRepository';
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
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { computeHabitStreaksFromEvents } from '../utils/habitStreakCompute';
import {
  formatTrackerHistoryDayValue,
  truncateNotePreview,
} from '../utils/trackerHistoryFormat';

const CHART_DAYS = 14;

type Props = NativeStackScreenProps<RootStackParamList, 'TrackerHistory'>;

interface DayRow {
  date: string;
  total: number;
  label: string;
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
  const [notesByDate, setNotesByDate] = useState<Map<string, string>>(new Map());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const loadGenerationRef = useRef(0);
  const noteSavingRef = useRef(false);
  const editingDateRef = useRef<string | null>(null);
  editingDateRef.current = editingDate;

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
        return true;
      }

      setElement(loaded);

      const range = lastNDates(CHART_DAYS);
      const since = range[0];
      // Sequential reads — concurrent prepareAsync can fail on shared SQLite.
      const rows = await eventRepo.getDailyTotalsByElement(db, elementId, since);
      if (generation !== loadGenerationRef.current) return false;
      const notes = await dayNoteRepo.getNotesForElementInRange(db, elementId, since);
      if (generation !== loadGenerationRef.current) return false;
      const byDate = new Map(rows.map((r) => [r.date, r.total]));
      const noteByDate = new Map(notes.map((n) => [n.date, n.body]));
      setNotesByDate(noteByDate);

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
        if (generation !== loadGenerationRef.current) return false;
        const { streak: currentStreak, failureStreak: currentFailureStreak } =
          computeHabitStreaksFromEvents(
            yearRows,
            config,
            undefined,
            createdOnLocalDate(loaded.createdAt),
          );
        setStreak(currentStreak);
        setFailureStreak(currentFailureStreak);
      } else {
        setStreak(0);
        setFailureStreak(0);
      }
      return true;
    } catch (err) {
      if (generation !== loadGenerationRef.current) return false;
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Could not load history');
      }
      return false;
    } finally {
      if (generation === loadGenerationRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [elementId]);

  useFocusEffect(
    useCallback(() => {
      // Don't reload under an open editor (avoids list flicker / dirty-state confusion).
      if (editingDateRef.current) return;
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    if (element?.name) {
      navigation.setOptions({ title: element.name });
    }
  }, [element?.name, navigation]);

  const handleSaveNote = async (body: string) => {
    const date = editingDate;
    if (!date || noteSavingRef.current) return;
    noteSavingRef.current = true;
    setNoteSaving(true);
    const trimmed = body.trim();
    try {
      await withDbWriteLock(async () => {
        const db = await getDatabase();
        await dayNoteRepo.upsertNote(db, {
          elementId,
          date,
          body,
        });
      });

      // Optimistic list update so a failed silent reload cannot leave a stale preview.
      setNotesByDate((prev) => {
        const next = new Map(prev);
        if (trimmed.length === 0) next.delete(date);
        else next.set(date, trimmed);
        return next;
      });
      setEditingDate(null);
      void load({ silent: true });
    } catch (err) {
      Alert.alert(
        'Could not save note',
        err instanceof Error ? err.message : 'Something went wrong. Try again.',
      );
    } finally {
      noteSavingRef.current = false;
      setNoteSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error && !element) {
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
  const best = completedDays.reduce<DayRow | null>((max, d) => {
    if (!max) return d;
    if (d.total > max.total) return d;
    if (d.total === max.total && d.date > max.date) return d;
    return max;
  }, null);
  const lastCompleted = completedDays.reduce<DayRow | null>((latest, d) => {
    if (!latest || d.date > latest.date) return d;
    return latest;
  }, null);

  return (
    <>
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
                  ? `Last completed: ${formatFullDate((lastCompleted ?? best).date)}`
                  : isTimerHabit
                    ? `Best day: ${formatHabitTimerDuration(best.total)} on ${formatFullDate(best.date)}`
                    : `Best day: ${formatTrackerHistoryDayValue(element, best.total)} on ${formatFullDate(best.date)}`}
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
        <Text variant="bodySmall" style={styles.listHint}>
          Tap a day to add or edit a note (last {CHART_DAYS} days)
        </Text>
        {days
          .slice()
          .reverse()
          .map((day) => {
            const noteBody = notesByDate.get(day.date);
            const notePreview = noteBody ? truncateNotePreview(noteBody) : null;
            const dayValue = formatTrackerHistoryDayValue(element, day.total);
            return (
            <Pressable
              key={day.date}
              onPress={() => setEditingDate(day.date)}
              accessibilityRole="button"
              accessibilityLabel={
                notePreview
                  ? `${formatFullDate(day.date)}, ${dayValue}, edit note`
                  : `${formatFullDate(day.date)}, ${dayValue}, add note`
              }
              android_ripple={{ color: theme.colors.primaryContainer }}
              style={[
                styles.row,
                {
                  borderBottomColor: theme.colors.outlineVariant,
                  borderBottomWidth: isCartoon ? deco.borderWidth : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text variant="bodyMedium">{formatFullDate(day.date)}</Text>
                  <Text variant="bodyMedium" style={styles.rowTotal}>
                    {dayValue}
                  </Text>
                </View>
                {notePreview ? (
                  <View style={styles.noteRow}>
                    <MaterialCommunityIcons
                      name="note-text-outline"
                      size={14}
                      color={theme.colors.primary}
                      style={styles.noteIcon}
                    />
                    <Text
                      variant="bodySmall"
                      numberOfLines={1}
                      style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
                    >
                      {notePreview}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noteRow}>
                    <MaterialCommunityIcons
                      name="note-plus-outline"
                      size={14}
                      color={theme.colors.onSurfaceVariant}
                      style={styles.noteIcon}
                    />
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
                    >
                      Add note
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
            );
          })}
      </ScrollView>

      <DayNoteEditorSheet
        visible={editingDate != null}
        date={editingDate}
        trackerName={element.name}
        initialBody={editingDate ? (notesByDate.get(editingDate) ?? '') : ''}
        saving={noteSaving}
        onDismiss={() => {
          if (noteSaving) return;
          setEditingDate(null);
        }}
        onSave={(body) => void handleSaveNote(body)}
      />
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
    marginBottom: 4,
    opacity: 0.8,
  },
  listHint: {
    marginBottom: 8,
    opacity: 0.65,
  },
  row: {
    paddingVertical: 10,
  },
  rowMain: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTotal: {
    fontWeight: '600',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  noteIcon: {
    marginRight: 4,
  },
});
