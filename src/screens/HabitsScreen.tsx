import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useTodayTrackerNotes } from '../hooks/useTodayTrackerNotes';
import { refreshAllHabitData, useRefreshHabitDayOnFocus } from '../hooks/useHabitDataRefresh';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import type { HomeNotebookChip } from '../notes';
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
import { DraggableTrackerList } from './shared/DraggableTrackerList';
import {
  HomeTabScrollView,
  type HomeTabScrollViewHandle,
} from './shared/HomeTabScrollView';
import { homeTabScreenStyles } from './shared/screenStyles';

type Props = {
  notebooks: HomeNotebookChip[];
  onDictateNotebook: (notebookId: string) => void;
  onEditNotebook: (notebookId: string) => void;
  /** True while Home's journal sheet is open — dismisses this screen's tracker note sheet. */
  journalOpen?: boolean;
  /** False while another Home tab is active — dismisses this screen's tracker note sheet. */
  notesActive?: boolean;
  /** Called before opening a tracker note so Home can dismiss the journal sheet. */
  onBeforeOpenTrackerNote?: () => void;
  /** Lets Home lock Habit↔Counter swipe while this tab's note sheet is open. */
  onTrackerNotesOpenChange?: (open: boolean) => void;
  /** Lets Home lock Habit↔Counter swipe while dragging to reorder. */
  onTrackerDragActiveChange?: (active: boolean) => void;
};

export default function HabitsScreen({
  notebooks,
  onDictateNotebook,
  onEditNotebook,
  journalOpen = false,
  notesActive = true,
  onBeforeOpenTrackerNote,
  onTrackerNotesOpenChange,
  onTrackerDragActiveChange,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const { t: tTrackers } = useTranslation('trackers');
  const { isCartoon } = useAppTheme();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const reorderHabitToOrder = useElementStore((s) => s.reorderHabitToOrder);
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const dayStateReady = useEventStore((s) => s.dayStateReady);
  const now = useAppCalendarNow();
  const [scrollLocked, setScrollLocked] = useState(false);
  const scrollRef = useRef<HomeTabScrollViewHandle>(null);

  useEffect(() => {
    if (notesActive) return;
    setScrollLocked(false);
  }, [notesActive]);

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
  const habitById = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit])),
    [habits],
  );
  const { notesToday, reloadNotesToday, applySaved } = useTodayTrackerNotes(habitIds, now);

  const noteEditor = useNoteEditorSession({
    onSaved: (date, body, target) => {
      if (target.kind !== 'tracker') return;
      applySaved(date, target.elementId, body);
    },
  });

  const notesWereOpenRef = useRef(false);
  useEffect(() => {
    if (journalOpen || !notesActive) noteEditor.dismiss();
  }, [journalOpen, notesActive, noteEditor.dismiss]);

  useEffect(() => {
    const open = noteEditor.session != null;
    if (notesWereOpenRef.current && !open) {
      void reloadNotesToday();
    }
    notesWereOpenRef.current = open;
  }, [noteEditor.session, reloadNotesToday]);

  useEffect(() => {
    if (!notesActive) return;
    onTrackerNotesOpenChange?.(noteEditor.session != null);
  }, [notesActive, noteEditor.session, onTrackerNotesOpenChange]);

  /** Sort only among remaining — done stays parked at the bottom. */
  const reorderPeerIds = useMemo(
    () => habits.filter((habit) => !(habitDoneToday[habit.id] ?? false)).map((h) => h.id),
    [habits, habitDoneToday],
  );

  const reload = async () => {
    await refreshAllHabitData();
    await reloadNotesToday();
  };

  const editorHost = <NoteEditorHost session={noteEditor} />;
  const journalMeta = (
    <HomeTabMetaRow
      notebooks={notebooks}
      onDictateNotebook={onDictateNotebook}
      onEditNotebook={onEditNotebook}
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
        ? t('habitsTab.remaining', { count: remainingCount })
        : t('habitsTab.doneOfTotal', { done: doneCount, total: dueTodayHabits.length });

  let emptyMessage: string | null = null;
  let emptyWithCta = false;
  if (totalHabitCount === 0) {
    emptyMessage = t('habitsTab.emptyNoHabits');
    emptyWithCta = true;
  } else if (allHabits.length === 0) {
    emptyMessage = t('habitsTab.emptyNoActiveHabits');
    emptyWithCta = true;
  } else if (habits.length === 0) {
    emptyMessage = t('habitsTab.emptyNothingDueToday');
  }

  return (
    <>
    <HomeTabScrollView
      ref={scrollRef}
      scrollLocked={scrollLocked}
      contentContainerStyle={styles.container}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          <Button mode="outlined" onPress={() => void reload()}>
            {t('habitsTab.retry')}
          </Button>
        </View>
      ) : null}

      <HomeTabMetaRow
        notebooks={notebooks}
        onDictateNotebook={onDictateNotebook}
        onEditNotebook={onEditNotebook}
        leading={
          habits.length > 0 && statusLabel ? (
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
        <DraggableTrackerList
          itemIds={habitIds}
          draggableIds={reorderPeerIds}
          scrollRef={scrollRef}
          onDragActiveChange={(active) => {
            setScrollLocked(active);
            onTrackerDragActiveChange?.(active);
          }}
          onReorder={(nextIds) => {
            const nextPeers = nextIds.filter((id) => reorderPeerIds.includes(id));
            return reorderHabitToOrder(nextPeers).catch((error) => {
              Alert.alert(
                tCommon('alerts.couldNotSave'),
                error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
              );
              throw error;
            });
          }}
          renderItem={(id, drag) => {
            const habit = habitById.get(id);
            const config = habit ? habitConfigs.get(habit.id) : undefined;
            if (!habit || !config) return null;
            const isDone = habitDoneToday[habit.id] ?? false;
            const canReorder =
              drag.canDrag && !isDone && reorderPeerIds.includes(habit.id);
            return (
              <HabitRow
                habit={habit}
                config={config}
                dimmed={isDone}
                onLongPressReorder={canReorder ? drag.onLongPress : undefined}
                delayLongPressReorder={drag.delayLongPress}
                onReorderTouchMove={canReorder ? drag.onTouchMove : undefined}
                onReorderTouchEnd={canReorder ? drag.onTouchEnd : undefined}
                onReorderTouchCancel={canReorder ? drag.onTouchCancel : undefined}
                reorderHint={
                  canReorder ? tTrackers('habitWidget.reorderLongPressHint') : undefined
                }
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
          }}
        />
      )}
    </HomeTabScrollView>
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
    statusText: {
      opacity: 0.85,
    },
  }),
};
