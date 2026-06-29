import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, Text, useTheme } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { playLoopingHabitSound, stopLoopingHabitSound } from '../audio/habitTimerSound';
import { useAppTheme } from '../hooks/useAppTheme';
import { getKindHandler } from '../kinds/registry';
import type { RootStackParamList } from '../navigation/types';
import {
  DAILY_VIEW_FILTER_LABELS,
  DAILY_VIEW_FILTERS,
  filterHabitsForDailyView,
  HABIT_TIME_SLOT_LABELS,
  HABIT_TIME_SLOT_ORDER,
  HabitConfigSchema,
  type HabitConfig,
  type HabitTimeSlot,
  toDateString,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { habitStreakInputsFromElements, useEventStore } from '../store/eventStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSoundLibraryStore } from '../store/soundLibraryStore';
import { getPinnedElements } from '../utils/dashboardElements';

export default function DailyScreen() {
  const theme = useTheme();
  const { isCartoon } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const load = useElementStore((s) => s.load);
  const {
    dailyTotals,
    habitDoneToday,
    habitStreaks,
    activeTimerSessions,
    loadHabitDayState,
    loadHabitStreaks,
    toggleHabit,
    startHabitTimer,
    stopHabitTimer,
  } = useEventStore();
  const loadSounds = useSoundLibraryStore((s) => s.load);
  const getSoundById = useSoundLibraryStore((s) => s.getById);
  const dailyViewFilter = useSettingsStore((s) => s.dailyViewFilter);
  const setDailyViewFilter = useSettingsStore((s) => s.setDailyViewFilter);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const allHabits = useMemo(
    () => getPinnedElements(
      elements.filter((e) => e.kind === 'habit'),
      dashboard,
    ),
    [elements, dashboard],
  );

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

  const habitHandler = getKindHandler('habit');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      void stopLoopingHabitSound();
    };
  }, []);

  const refresh = useCallback(async () => {
    await load();
    await loadSounds();
    const { elements, dashboard } = useElementStore.getState();
    const habitElements = getPinnedElements(
      elements.filter((e) => e.kind === 'habit'),
      dashboard,
    );
    const inputs = habitStreakInputsFromElements(habitElements);
    if (inputs.length > 0) {
      await loadHabitDayState(inputs);
      await loadHabitStreaks(inputs);
    }
  }, [load, loadHabitDayState, loadHabitStreaks, loadSounds]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleStartTimer = useCallback(
    async (elementId: string, config: HabitConfig) => {
      startHabitTimer(elementId);
      const sound = config.soundId ? getSoundById(config.soundId) : undefined;
      if (sound?.source === 'file') {
        try {
          await playLoopingHabitSound(sound.uri);
        } catch {
          // Playback can fail if the file was removed.
        }
      }
    },
    [getSoundById, startHabitTimer],
  );

  const handleStopTimer = useCallback(
    async (elementId: string, config: HabitConfig) => {
      await stopLoopingHabitSound();
      await stopHabitTimer(elementId, config);
    },
    [stopHabitTimer],
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
          No habits pinned. Open Settings and pin habits to show them here.
        </Text>
      ) : habits.length === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          {dailyViewFilter === 'all'
            ? 'No habits match this filter.'
            : 'Nothing due right now for this filter.'}
        </Text>
      ) : !habitHandler ? null : (
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
                const config = HabitConfigSchema.parse(habit.config);
                const Widget = habitHandler.DashboardWidget;

                return (
                  <Widget
                    key={habit.id}
                    element={habit}
                    config={config}
                    todayTotal={dailyTotals[habit.id] ?? 0}
                    isDone={habitDoneToday[habit.id] ?? false}
                    streak={habitStreaks[habit.id] ?? 0}
                    activeTimerSession={activeTimerSessions[habit.id] ?? null}
                    onLog={async () => {}}
                    onToggle={() => toggleHabit(habit.id, config)}
                    onStartTimer={() => handleStartTimer(habit.id, config)}
                    onStopTimer={() => handleStopTimer(habit.id, config)}
                    onOpenDetails={() =>
                      navigation.navigate('ElementHistory', { elementId: habit.id })
                    }
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
});
