import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';
import FilledField from '../components/sheet/FilledField';
import { getDatabase } from '../db/client';
import * as todoRepo from '../db/repositories/todoRepository';
import { getDateLocale } from '../i18n';
import { toDateString, type Todo } from '../protocol';
import { formatShortDate } from '../utils/dates';
import { useAppTheme } from '../hooks/useAppTheme';
import { layout, space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

/** Enough to scroll through a year of todos without mounting a decade of them. */
const HISTORY_LIMIT = 200;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function completionDate(todo: Todo): string {
  // completed_at is a UTC timestamp; group by the local day it happened on,
  // matching the `date(completed_at, 'localtime')` the date filter uses.
  return todo.completedAt ? toDateString(new Date(todo.completedAt)) : '';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(getDateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Completed todos, newest first. Read straight from SQLite rather than through
 * the todo store: the store holds the open list, and years of finished todos
 * have no business sitting in memory behind the Today page.
 */
export default function TodoHistoryScreen() {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const { t } = useTranslation('todos');

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const activeDate = DATE_ONLY.test(dateFilter.trim()) ? dateFilter.trim() : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const rows = await todoRepo.getCompletedTodos(db, {
        search: search.trim() || undefined,
        date: activeDate,
        limit: HISTORY_LIMIT,
      });
      setTodos(rows);
      setError(false);
    } catch (loadError) {
      console.warn('Failed to load todo history', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search, activeDate]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Day headings, in the order the query already returned. */
  const days = useMemo(() => {
    const groups: { date: string; todos: Todo[] }[] = [];
    for (const todo of todos) {
      const date = completionDate(todo);
      const last = groups[groups.length - 1];
      if (last?.date === date) {
        last.todos.push(todo);
        continue;
      }
      groups.push({ date, todos: [todo] });
    }
    return groups;
  }, [todos]);

  const filtering = search.trim().length > 0 || activeDate != null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <FilledField
        fill="page"
        value={search}
        onChangeText={setSearch}
        placeholder={t('history.searchPlaceholder')}
        returnKeyType="search"
        style={styles.search}
      />

      <FilledField
        fill="page"
        label={t('history.dateFilter')}
        placeholder="YYYY-MM-DD"
        value={dateFilter}
        onChangeText={setDateFilter}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        style={styles.dateField}
        rightAccessory={
          dateFilter.length > 0 ? (
            <Button compact onPress={() => setDateFilter('')}>
              {t('history.dateClear')}
            </Button>
          ) : undefined
        }
      />

      {loading ? <ActivityIndicator style={styles.spinner} /> : null}

      {error ? (
        <Text style={[typeScale.secondary, { color: theme.colors.error }]}>
          {t('history.loadFailed')}
        </Text>
      ) : null}

      {!loading && !error && todos.length === 0 ? (
        <EmptyState message={filtering ? t('history.emptySearch') : t('history.empty')} />
      ) : null}

      {days.map((day) => (
        <View key={day.date} style={styles.day}>
          <Text
            accessibilityRole="header"
            style={[styles.dayHeading, { color: theme.colors.onSurfaceVariant }]}
          >
            {formatShortDate(day.date)}
          </Text>
          {day.todos.map((todo) => (
            <View
              key={todo.id}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: deco.radius.lg,
                },
              ]}
            >
              <Text style={[typeScale.body, { color: theme.colors.onSurface }]}>
                {todo.title}
              </Text>
              {todo.note ? (
                <Text
                  numberOfLines={3}
                  style={[typeScale.secondary, { color: theme.colors.onSurfaceVariant }]}
                >
                  {todo.note}
                </Text>
              ) : null}
              {todo.completedAt ? (
                <Text style={[typeScale.caption, { color: theme.colors.onSurfaceVariant }]}>
                  {t('history.completedAt', { time: formatTime(todo.completedAt) })}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  search: {
    marginBottom: space.md,
  },
  dateField: {
    marginBottom: layout.sectionGap,
  },
  spinner: {
    marginTop: space.xl,
  },
  day: {
    marginBottom: layout.sectionGap - layout.rowGap,
  },
  dayHeading: {
    ...typeScale.caption,
    fontSize: 14,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  row: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: layout.rowGap,
    gap: space.xxs,
  },
});
