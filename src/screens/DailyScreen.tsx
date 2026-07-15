import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Menu, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { refreshAllHabitData, useRefreshHabitDayOnFocus } from '../hooks/useHabitDataRefresh';
import {
  DAILY_REORDER_VIEW,
  DAILY_VIEW_FILTER_LABELS,
  DAILY_VIEW_FILTERS,
  HABIT_TIME_SLOT_LABELS,
  filterHabitsForDailyView,
  groupHabitsForDailyView,
  parseHabitConfig,
  toDateString,
  type HabitConfig,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { getActiveHabits } from '../utils/dashboardElements';
import HabitDailyRow from './daily/HabitDailyRow';
import { homeTabScreenStyles } from './shared/screenStyles';

export default function DailyScreen() {
  const theme = useTheme();
  const { isCartoon } = useAppTheme();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const reorderHabitInSlot = useElementStore((s) => s.reorderHabitInSlot);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const dailyViewFilter = useSettingsStore((s) => s.dailyViewFilter);
  const setDailyViewFilter = useSettingsStore((s) => s.setDailyViewFilter);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

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

  const activeFilter = reordering ? DAILY_REORDER_VIEW : dailyViewFilter;

  const habits = useMemo(
    () => filterHabitsForDailyView(allHabits, activeFilter, filterContext),
    [allHabits, activeFilter, filterContext],
  );

  const dueTodayHabits = useMemo(
    () => filterHabitsForDailyView(allHabits, 'all', filterContext),
    [allHabits, filterContext],
  );

  const sections = useMemo(
    () => groupHabitsForDailyView(habits, activeFilter, habitConfigs),
    [habits, activeFilter, habitConfigs],
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

  const doneCount = dueTodayHabits.filter((h) => habitDoneToday[h.id]).length;
  const remainingCount = dueTodayHabits.length - doneCount;
  // Prefer "N remaining" while work is left; otherwise compact "N of N".
  const statusLabel =
    dueTodayHabits.length === 0
      ? null
      : remainingCount > 0
        ? `${remainingCount} remaining`
        : `${doneCount} of ${dueTodayHabits.length}`;

  let emptyMessage: string | null = null;
  if (totalHabitCount === 0) {
    emptyMessage = 'No habits yet. Open Settings to add one.';
  } else if (allHabits.length === 0) {
    emptyMessage = 'No active habits. Open Settings → Elements to restore something from Archive.';
  } else if (habits.length === 0) {
    emptyMessage = 'Nothing to show for this view.';
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          enabled={!reordering}
        />
      }
    >
      <View style={styles.metaRow}>
        <View style={styles.metaStatus}>
          {reordering ? (
            <Text variant="bodySmall" style={styles.metaQuiet}>
              Move within each time of day
            </Text>
          ) : statusLabel ? (
            <Text
              variant="bodyMedium"
              style={[
                styles.statusText,
                isCartoon && {
                  color: theme.colors.onSecondaryContainer,
                  fontWeight: '600',
                },
              ]}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.metaRight}>
          {reordering ? (
            <Button compact mode="text" onPress={() => setReordering(false)}>
              Done
            </Button>
          ) : (
            <>
              <Menu
                visible={viewMenuOpen}
                onDismiss={() => setViewMenuOpen(false)}
                anchor={
                  <Button
                    mode="text"
                    compact
                    icon="filter-variant"
                    onPress={() => setViewMenuOpen(true)}
                    contentStyle={styles.viewButtonContent}
                    labelStyle={styles.controlLabel}
                  >
                    {DAILY_VIEW_FILTER_LABELS[activeFilter]}
                  </Button>
                }
              >
                {DAILY_VIEW_FILTERS.map((filter) => (
                  <Menu.Item
                    key={filter}
                    title={DAILY_VIEW_FILTER_LABELS[filter]}
                    leadingIcon={dailyViewFilter === filter ? 'check' : undefined}
                    onPress={() => {
                      setViewMenuOpen(false);
                      void setDailyViewFilter(filter);
                    }}
                  />
                ))}
              </Menu>
              <Button
                mode="text"
                compact
                icon="sort"
                disabled={dueTodayHabits.length < 2}
                onPress={() => {
                  setViewMenuOpen(false);
                  setReordering(true);
                }}
                labelStyle={styles.controlLabel}
              >
                Sort
              </Button>
            </>
          )}
        </View>
      </View>

      {emptyMessage ? (
        <Text variant="bodyLarge" style={styles.empty}>
          {emptyMessage}
        </Text>
      ) : (
        sections.map(({ slot, items }) => (
          <View key={slot ?? 'flat'} style={styles.section}>
            {slot ? (
              <Text
                variant="labelMedium"
                style={[
                  styles.sectionTitle,
                  isCartoon && { color: theme.colors.outline },
                ]}
              >
                {HABIT_TIME_SLOT_LABELS[slot]}
              </Text>
            ) : null}
            {items.map((habit, index) => {
              const config = habitConfigs.get(habit.id);
              if (!config) return null;
              return (
                <HabitDailyRow
                  key={habit.id}
                  habit={habit}
                  config={config}
                  reordering={reordering}
                  canMoveUp={reordering && index > 0}
                  canMoveDown={reordering && index < items.length - 1}
                  onMoveUp={() => void reorderHabitInSlot(habit.id, 'up')}
                  onMoveDown={() => void reorderHabitInSlot(habit.id, 'down')}
                />
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = {
  ...homeTabScreenStyles,
  ...StyleSheet.create({
    metaRight: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
    },
    viewButtonContent: {
      maxWidth: 140,
    },
    controlLabel: {
      marginHorizontal: 4,
    },
    statusText: {
      opacity: 0.85,
    },
    metaQuiet: {
      opacity: 0.55,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      marginBottom: 6,
      opacity: 0.55,
      letterSpacing: 0.4,
    },
  }),
};
