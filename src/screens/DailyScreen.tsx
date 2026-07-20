import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { refreshAllHabitData, useRefreshHabitDayOnFocus } from '../hooks/useHabitDataRefresh';
import {
  filterHabitsDueToday,
  orderHabitsForDailyList,
  parseHabitConfig,
  toDateString,
  type HabitConfig,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { getActiveHabits } from '../utils/dashboardElements';
import HabitDailyRow from './daily/HabitDailyRow';
import EmptyTabState from './shared/EmptyTabState';
import { homeTabScreenStyles } from './shared/screenStyles';

export default function DailyScreen() {
  const theme = useTheme();
  const { isCartoon } = useAppTheme();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const reorderHabit = useElementStore((s) => s.reorderHabit);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
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

  const dueTodayHabits = useMemo(
    () => filterHabitsDueToday(allHabits, filterContext),
    [allHabits, filterContext],
  );

  const habits = useMemo(
    () => orderHabitsForDailyList(dueTodayHabits, habitDoneToday),
    [dueTodayHabits, habitDoneToday],
  );

  /** Sort only among remaining — done stays parked at the bottom. */
  const reorderPeerIds = useMemo(
    () => habits.filter((habit) => !(habitDoneToday[habit.id] ?? false)).map((h) => h.id),
    [habits, habitDoneToday],
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
  const statusLabel =
    dueTodayHabits.length === 0
      ? null
      : remainingCount > 0
        ? `${remainingCount} remaining`
        : `${doneCount} of ${dueTodayHabits.length}`;

  let emptyMessage: string | null = null;
  let emptyWithCta = false;
  if (totalHabitCount === 0) {
    emptyMessage = 'No habits yet. Add one to start your daily list.';
    emptyWithCta = true;
  } else if (allHabits.length === 0) {
    emptyMessage = 'No active habits. Restore something from Archive in Elements.';
    emptyWithCta = true;
  } else if (habits.length === 0) {
    emptyMessage = 'Nothing due today.';
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
              Move to set your order
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
            <Button
              mode="text"
              compact
              icon="sort"
              disabled={reorderPeerIds.length < 2}
              onPress={() => setReordering(true)}
              labelStyle={styles.controlLabel}
            >
              Sort
            </Button>
          )}
        </View>
      </View>

      {emptyMessage ? (
        emptyWithCta ? (
          <EmptyTabState message={emptyMessage} />
        ) : (
          <Text variant="bodyLarge" style={styles.empty}>
            {emptyMessage}
          </Text>
        )
      ) : (
        habits.map((habit) => {
          const config = habitConfigs.get(habit.id);
          if (!config) return null;
          const isDone = habitDoneToday[habit.id] ?? false;
          const peerIndex = reorderPeerIds.indexOf(habit.id);
          const canReorder = reordering && !isDone && peerIndex >= 0;
          return (
            <HabitDailyRow
              key={habit.id}
              habit={habit}
              config={config}
              reordering={canReorder}
              dimmed={isDone}
              canMoveUp={canReorder && peerIndex > 0}
              canMoveDown={canReorder && peerIndex < reorderPeerIds.length - 1}
              onMoveUp={() => void reorderHabit(habit.id, 'up', reorderPeerIds)}
              onMoveDown={() => void reorderHabit(habit.id, 'down', reorderPeerIds)}
            />
          );
        })
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
    controlLabel: {
      marginHorizontal: 4,
    },
    statusText: {
      opacity: 0.85,
    },
    metaQuiet: {
      opacity: 0.55,
    },
  }),
};
