import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Checkbox, List, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  HABIT_TIME_SLOT_LABELS,
  HABIT_TIME_SLOT_ORDER,
  HabitConfigSchema,
  formatHabitDescription,
  shouldShowHabitOnHabitsPage,
  type HabitTimeSlot,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';

export default function DailyScreen() {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const load = useElementStore((s) => s.load);
  const { habitDoneToday, loadHabitCompletions, toggleHabit } = useEventStore();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const allHabits = elements.filter((e) => e.kind === 'habit');
  const habits = allHabits.filter((habit) => {
    const config = HabitConfigSchema.parse(habit.config);
    return shouldShowHabitOnHabitsPage(config, now);
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    await load();
    const habitIds = useElementStore.getState().elements
      .filter((e) => e.kind === 'habit')
      .map((e) => e.id);
    if (habitIds.length > 0) {
      await loadHabitCompletions(habitIds);
    }
  }, [load, loadHabitCompletions]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
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
    items: habits.filter((h) => {
      const config = HabitConfigSchema.parse(h.config);
      return config.timeSlot === slot;
    }),
  })).filter((group) => group.items.length > 0);

  const doneCount = habits.filter((h) => habitDoneToday[h.id]).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {allHabits.length === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          No habits yet. Tap the gear icon to add one.
        </Text>
      ) : habits.length === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          No habits in their time window right now.
        </Text>
      ) : (
        <>
          <Text
            variant="bodyMedium"
            style={[
              styles.summary,
              isCartoon && { color: theme.colors.onSecondaryContainer, fontWeight: '600' },
            ]}
          >
            {doneCount} of {habits.length} done today
          </Text>
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
                const config = HabitConfigSchema.parse(habit.config);
                const done = habitDoneToday[habit.id] ?? false;
                return (
                  <List.Item
                    key={habit.id}
                    title={habit.name}
                    titleStyle={isCartoon ? styles.cartoonTitle : undefined}
                    description={formatHabitDescription(config)}
                    left={() => (
                      <Checkbox
                        status={done ? 'checked' : 'unchecked'}
                        onPress={() => void toggleHabit(habit.id)}
                      />
                    )}
                    onPress={() => void toggleHabit(habit.id)}
                    style={[
                      styles.habitRow,
                      {
                        backgroundColor: isCartoon
                          ? theme.colors.surface
                          : theme.colors.surfaceVariant,
                        borderColor: theme.colors.outlineVariant,
                        borderRadius: deco.radius.sm,
                        borderWidth: isCartoon ? deco.cardBorderWidth : deco.borderWidth,
                      },
                      done && styles.habitRowDone,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 48,
    paddingHorizontal: 24,
  },
  summary: {
    marginBottom: 16,
    opacity: 0.8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 4,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cartoonTitle: {
    fontWeight: '700',
  },
  habitRow: {
    marginBottom: 6,
  },
  habitRowDone: {
    opacity: 0.65,
  },
});
