import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { refreshAllHabitData, useRefreshHabitDayOnFocus } from '../hooks/useHabitDataRefresh';
import {
  DAILY_VIEW_FILTER_LABELS,
  DAILY_VIEW_FILTERS,
  filterHabitsForDailyView,
  HABIT_TIME_SLOT_LABELS,
  HABIT_TIME_SLOT_ORDER,
  parseHabitConfig,
  type HabitConfig,
  type HabitTimeSlot,
  toDateString,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getActiveHabits } from '../utils/dashboardElements';
import HabitDailyCard from './daily/HabitDailyCard';
import { homeTabScreenStyles } from './shared/screenStyles';

export default function DailyScreen() {
  const theme = useTheme();
  const { isCartoon } = useAppTheme();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const dailyViewFilter = useSettingsStore((s) => s.dailyViewFilter);
  const setDailyViewFilter = useSettingsStore((s) => s.setDailyViewFilter);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useRefreshHabitDayOnFocus();

  const allHabits = useMemo(
    () => getActiveHabits(elements, dashboard),
    [elements, dashboard],
  );

  const habitConfigs = useMemo(() => {
    const configs = new Map<string, HabitConfig>();
    for (const habit of allHabits) {
      configs.set(habit.id, parseHabitConfig(habit.config));
    }
    return configs;
  }, [allHabits]);

  const totalHabitCount = useMemo(
    () => elements.filter((e) => e.kind === 'habit').length,
    [elements],
  );

  const filterContext = useMemo(
    () => ({
      now,
      today: toDateString(now),
      habitDoneToday,
    }),
    [now, habitDoneToday],
  );

  const habits = useMemo(
    () => filterHabitsForDailyView(allHabits, dailyViewFilter, filterContext),
    [allHabits, dailyViewFilter, filterContext],
  );

  const dueTodayHabits = useMemo(
    () => filterHabitsForDailyView(allHabits, 'all_due', filterContext),
    [allHabits, filterContext],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllHabitData();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading && allHabits.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const habitsBySlot = HABIT_TIME_SLOT_ORDER.map((slot) => ({
    slot,
    items: habits.filter((habit) => habitConfigs.get(habit.id)?.timeSlot === slot),
  })).filter((group) => group.items.length > 0);

  const doneCount = dueTodayHabits.filter((h) => habitDoneToday[h.id]).length;

  const filterChips = allHabits.length > 0 ? (
    <View style={styles.filterRow}>
      {DAILY_VIEW_FILTERS.map((filter) => (
        <Chip
          key={filter}
          selected={dailyViewFilter === filter}
          onPress={() => void setDailyViewFilter(filter)}
          compact
        >
          {DAILY_VIEW_FILTER_LABELS[filter]}
        </Chip>
      ))}
    </View>
  ) : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {filterChips}
      {totalHabitCount === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          No habits yet. Open Settings to add one.
        </Text>
      ) : allHabits.length === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          No active habits. Open Settings → Elements to restore something from Archive.
        </Text>
      ) : habits.length === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          {dailyViewFilter === 'all'
            ? 'No habits match this filter.'
            : 'Nothing due right now for this filter.'}
        </Text>
      ) : (
        <>
          {dueTodayHabits.length > 0 ? (
            <Text
              variant="bodyMedium"
              style={[
                styles.summary,
                isCartoon && { color: theme.colors.onSecondaryContainer, fontWeight: '600' },
              ]}
            >
              {doneCount} of {dueTodayHabits.length} done today
            </Text>
          ) : null}
          {habitsBySlot.map(({ slot, items }) => (
            <View key={slot} style={styles.section}>
              <Text
                variant="titleSmall"
                style={[
                  styles.sectionTitle,
                  isCartoon && { color: theme.colors.outline, fontWeight: '700' },
                ]}
              >
                {HABIT_TIME_SLOT_LABELS[slot as HabitTimeSlot]}
              </Text>
              {items.map((habit) => {
                const config = habitConfigs.get(habit.id);
                if (!config) return null;
                return <HabitDailyCard key={habit.id} habit={habit} config={config} />;
              })}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = {
  ...homeTabScreenStyles,
  ...StyleSheet.create({
    summary: {
      marginBottom: 16,
      opacity: 0.8,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      marginBottom: 8,
      opacity: 0.7,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  }),
};
