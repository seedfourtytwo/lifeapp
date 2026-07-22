import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useTodayTrackerNotes } from '../hooks/useTodayTrackerNotes';
import { refreshAllHabitData, useRefreshHabitDayOnFocus } from '../hooks/useHabitDataRefresh';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import {
  filterHabitsDueToday,
  orderHabitsList,
  parseHabitConfig,
  type HabitConfig,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { getActiveHabits } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import HabitRow from './habits/HabitRow';
import EmptyTabState from './shared/EmptyTabState';
import HomeTabMetaRow from './shared/HomeTabMetaRow';
import { homeTabScreenStyles } from './shared/screenStyles';

type Props = {
  hasTodayJournal: boolean;
  onOpenJournal: () => void;
  onEditJournal?: () => void;
  /** True while Home's journal sheet is open — dismisses this screen's tracker note sheet. */
  journalOpen?: boolean;
  /** False while another Home tab is active — dismisses this screen's tracker note sheet. */
  notesActive?: boolean;
  /** Called before opening a tracker note so Home can dismiss the journal sheet. */
  onBeforeOpenTrackerNote?: () => void;
};

export default function HabitsScreen({
  hasTodayJournal,
  onOpenJournal,
  onEditJournal,
  journalOpen = false,
  notesActive = true,
  onBeforeOpenTrackerNote,
}: Props) {
  const theme = useTheme();
  const { isCartoon } = useAppTheme();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const reorderHabit = useElementStore((s) => s.reorderHabit);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const dayStateReady = useEventStore((s) => s.dayStateReady);
  const [refreshing, setRefreshing] = useState(false);
  const now = useAppCalendarNow();
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
      today: currentAppCalendarDate(now),
      habitDoneToday,
    }),
    [now, habitDoneToday],
  );

  const dueTodayHabits = useMemo(
    () => filterHabitsDueToday(allHabits, filterContext),
    [allHabits, filterContext],
  );

  const habits = useMemo(
    () => orderHabitsList(dueTodayHabits, habitDoneToday),
    [dueTodayHabits, habitDoneToday],
  );

  const habitIds = useMemo(() => habits.map((h) => h.id), [habits]);
  const { notesToday, reloadNotesToday, applySaved } = useTodayTrackerNotes(habitIds, now);

  const noteEditor = useNoteEditorSession({
    onSaved: (date, body, target) => {
      if (target.kind !== 'tracker') return;
      applySaved(date, target.elementId, body);
    },
  });

  useEffect(() => {
    if (journalOpen || !notesActive) noteEditor.dismiss();
  }, [journalOpen, notesActive, noteEditor.dismiss]);

  /** Sort only among remaining — done stays parked at the bottom. */
  const reorderPeerIds = useMemo(
    () => habits.filter((habit) => !(habitDoneToday[habit.id] ?? false)).map((h) => h.id),
    [habits, habitDoneToday],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllHabitData();
      await reloadNotesToday();
    } finally {
      setRefreshing(false);
    }
  };

  const editorHost = <NoteEditorHost session={noteEditor} />;
  const journalMeta = (
    <HomeTabMetaRow
      hasTodayJournal={hasTodayJournal}
      onOpenJournal={onOpenJournal}
      onEditJournal={onEditJournal}
    />
  );

  if (isLoading && allHabits.length === 0 && !error) {
    return (
      <>
        <View style={styles.loadingPane}>
          {journalMeta}
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        </View>
        {editorHost}
      </>
    );
  }

  // Wait for today's completion map before enabling toggles (avoids double-ticks).
  if (allHabits.length > 0 && !dayStateReady && !error) {
    return (
      <>
        <View style={styles.loadingPane}>
          {journalMeta}
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        </View>
        {editorHost}
      </>
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
    emptyMessage = 'No active habits. Restore something from Archive in Trackers.';
    emptyWithCta = true;
  } else if (habits.length === 0) {
    emptyMessage = 'Nothing due today — check schedule or time window in Trackers.';
  }

  return (
    <>
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
      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          <Button mode="outlined" onPress={() => void onRefresh()}>
            Retry
          </Button>
        </View>
      ) : null}

      <HomeTabMetaRow
        hasTodayJournal={hasTodayJournal}
        onOpenJournal={onOpenJournal}
        onEditJournal={onEditJournal}
        leading={
          habits.length > 0 ? (
            reordering ? (
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
            ) : null
          ) : null
        }
        trailing={
          habits.length > 0 ? (
            reordering ? (
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
            )
          ) : null
        }
      />

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
            <HabitRow
              key={habit.id}
              habit={habit}
              config={config}
              reordering={canReorder}
              dimmed={isDone}
              canMoveUp={canReorder && peerIndex > 0}
              canMoveDown={canReorder && peerIndex < reorderPeerIds.length - 1}
              onMoveUp={() => void reorderHabit(habit.id, 'up', reorderPeerIds)}
              onMoveDown={() => void reorderHabit(habit.id, 'down', reorderPeerIds)}
              hasTodayNote={notesToday.has(habit.id)}
              onDictateNote={() => {
                onBeforeOpenTrackerNote?.();
                void noteEditor.open(
                  { kind: 'tracker', elementId: habit.id, label: habit.name },
                  currentAppCalendarDate(now),
                  { dictate: true },
                );
              }}
              onEditNote={() => {
                onBeforeOpenTrackerNote?.();
                void noteEditor.open(
                  { kind: 'tracker', elementId: habit.id, label: habit.name },
                  currentAppCalendarDate(now),
                );
              }}
            />
          );
        })
      )}
    </ScrollView>
    {editorHost}
    </>
  );
}

const styles = {
  ...homeTabScreenStyles,
  ...StyleSheet.create({
    loadingPane: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
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
