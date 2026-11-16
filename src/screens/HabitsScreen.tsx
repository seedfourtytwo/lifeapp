import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { ACTIVITY_DAYS, useRecentActivity } from '../hooks/useRecentActivity';
import { refreshAllHabitData } from '../hooks/refreshAllDailyData';
import { useRefreshHabitDayOnFocus } from '../hooks/useHabitDataRefresh';
import { NoteEditorHost } from '../notes';
import {
  filterHabitsDueToday,
  parseHabitConfig,
  type ElementDefinition,
  type HabitConfig,
} from '../protocol';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { getActiveHabits } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import HabitCard from './habits/HabitCard';
import EmptyTabState from './shared/EmptyTabState';
import DayHeader from './shared/DayHeader';
import { habitHeaderMeta } from './shared/dayHeaderMeta';
import HomeTabLoadingPane from './shared/HomeTabLoadingPane';
import NotebookButtons from './shared/NotebookButtons';
import {
  DraggableTrackerList,
  type DraggableRenderContext,
} from './shared/DraggableTrackerList';
import {
  HomeTabScrollView,
  type HomeTabScrollViewHandle,
} from './shared/HomeTabScrollView';
import { homeTabScreenStyles } from './shared/screenStyles';
import type { HomeTrackerTabProps } from './shared/homeTabProps';
import { useHomeTrackerNotes } from './shared/useHomeTrackerNotes';

type Props = HomeTrackerTabProps;

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
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const reorderHabitToOrder = useElementStore((s) => s.reorderHabitToOrder);
  const dayStateReady = useEventStore((s) => s.dayStateReady);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const now = useAppCalendarNow();
  const [scrollLocked, setScrollLocked] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<{
    message: string;
    undo: () => Promise<void>;
  } | null>(null);
  const scrollRef = useRef<HomeTabScrollViewHandle>(null);

  useEffect(() => {
    if (notesActive) return;
    setScrollLocked(false);
    // Undo belongs to the page it was offered on; leaving the page settles it.
    setPendingUndo(null);
  }, [notesActive]);

  const offerUndo = useCallback(
    (message: string, undo: () => Promise<void>) => setPendingUndo({ message, undo }),
    [],
  );

  const runUndo = () => {
    const pending = pendingUndo;
    setPendingUndo(null);
    pending?.undo().catch((error) => {
      Alert.alert(
        tCommon('alerts.couldNotSave'),
        error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
      );
    });
  };

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

  // Due-ness depends on the day and the configs, never on ticks.
  const dueTodayHabits = useMemo(
    () =>
      filterHabitsDueToday(
        allHabits,
        { now, today: currentAppCalendarDate(now) },
        habitConfigs,
      ),
    [allHabits, habitConfigs, now],
  );
  const dueIds = useMemo(() => dueTodayHabits.map((h) => h.id), [dueTodayHabits]);

  // Subscribe to derived primitives, not the whole maps: a tick re-renders this
  // screen only when the done set or the best streak actually moves, and each
  // card reads its own slice (see HabitCard).
  const doneKey = useEventStore((s) =>
    dueIds.filter((id) => s.habitDoneToday[id] ?? false).join('\n'),
  );
  const bestStreak = useEventStore((s) =>
    dueIds.reduce((best, id) => Math.max(best, s.habitStreaks[id] ?? 0), 0),
  );
  const doneIds = useMemo(
    () => new Set(doneKey.length > 0 ? doneKey.split('\n') : []),
    [doneKey],
  );

  /** Remaining first (user sort_order), then done (user sort_order). */
  const habits = useMemo(() => {
    const remaining: ElementDefinition[] = [];
    const done: ElementDefinition[] = [];
    for (const habit of dueTodayHabits) {
      (doneIds.has(habit.id) ? done : remaining).push(habit);
    }
    return [...remaining, ...done];
  }, [dueTodayHabits, doneIds]);

  const habitIds = useMemo(() => habits.map((h) => h.id), [habits]);

  // The strip covers every active habit, not only the ones due today — it is a
  // record of the fortnight, and a habit scheduled twice a week still counts.
  const allHabitIds = useMemo(() => allHabits.map((h) => h.id), [allHabits]);
  const activity = useRecentActivity(allHabitIds);

  /**
   * "3 of 5 done" and "41 days in a row". The run shown is the best one going,
   * because the header answers "how am I doing", not "how is each habit doing".
   */
  const headerMeta = useMemo(
    () =>
      habitHeaderMeta({
        due: habits.length,
        done: doneIds.size,
        bestStreak,
      }),
    [habits.length, doneIds.size, bestStreak],
  );

  const activityLabel = useMemo(
    () =>
      t('dayHeader.activityA11y', {
        days: ACTIVITY_DAYS,
        count: activity.filter((day) => day.active).length,
      }),
    [activity, t],
  );
  const habitById = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit])),
    [habits],
  );
  const { notesToday, reloadNotesToday, noteEditor } = useHomeTrackerNotes({
    elementIds: habitIds,
    now,
    journalOpen,
    notesActive,
    onTrackerNotesOpenChange,
  });

  /** Sort only among remaining — done stays parked at the bottom. */
  const reorderPeerIds = useMemo(
    () => habits.filter((habit) => !doneIds.has(habit.id)).map((h) => h.id),
    [habits, doneIds],
  );
  const reorderPeerSet = useMemo(() => new Set(reorderPeerIds), [reorderPeerIds]);

  // Stable callbacks for the memoised cards; the latest values ride on a ref.
  const latest = useRef({ noteEditor, now, onBeforeOpenTrackerNote });
  latest.current = { noteEditor, now, onBeforeOpenTrackerNote };
  const openNote = useCallback((habit: ElementDefinition, dictate: boolean) => {
    const { noteEditor: editor, now: at, onBeforeOpenTrackerNote: beforeOpen } = latest.current;
    beforeOpen?.();
    void editor.open(
      { kind: 'tracker', elementId: habit.id, label: habit.name },
      currentAppCalendarDate(at),
      dictate ? { dictate: true } : undefined,
    );
  }, []);

  const reorderHint = tTrackers('habitWidget.reorderLongPressHint');
  const renderHabit = useCallback(
    (id: string, drag: DraggableRenderContext) => {
      const habit = habitById.get(id);
      const config = habit ? habitConfigs.get(habit.id) : undefined;
      if (!habit || !config) return null;
      // Done rows are not peers, so peer membership already excludes them.
      const canReorder = drag.canDrag && reorderPeerSet.has(habit.id);
      return (
        <HabitCard
          habit={habit}
          config={config}
          onLongPressReorder={canReorder ? drag.onLongPress : undefined}
          delayLongPressReorder={drag.delayLongPress}
          onReorderTouchMove={canReorder ? drag.onTouchMove : undefined}
          onReorderTouchEnd={canReorder ? drag.onTouchEnd : undefined}
          onReorderTouchCancel={canReorder ? drag.onTouchCancel : undefined}
          reorderHint={canReorder ? reorderHint : undefined}
          onOfferUndo={offerUndo}
          hasTodayNote={notesToday.has(habit.id)}
          onOpenNote={openNote}
        />
      );
    },
    [habitById, habitConfigs, notesToday, offerUndo, openNote, reorderHint, reorderPeerSet],
  );

  const reload = async () => {
    await refreshAllHabitData();
    await reloadNotesToday();
  };

  const editorHost = <NoteEditorHost session={noteEditor} />;

  // Wait for elements, then for today's completion map before enabling toggles
  // (a toggle before day-state lands would double-tick).
  const waitingForData =
    (isLoading && allHabits.length === 0) || (allHabits.length > 0 && !dayStateReady);
  if (waitingForData && !error) {
    return (
      <>
        <HomeTabLoadingPane
          actions={
            <NotebookButtons
              notebooks={notebooks}
              onDictateNotebook={onDictateNotebook}
              onEditNotebook={onEditNotebook}
            />
          }
        />
        {editorHost}
      </>
    );
  }

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

      <DayHeader
        now={now}
        meta={headerMeta}
        activity={activity}
        activityLabel={activityLabel}
        actions={
          <>
            <NotebookButtons
              notebooks={notebooks}
              onDictateNotebook={onDictateNotebook}
              onEditNotebook={onEditNotebook}
            />
            <IconButton
              icon="plus"
              size={24}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() => navigation.navigate('Trackers', { add: 'habit' })}
              accessibilityLabel={t('habitsTab.addHabitA11y')}
              style={addButtonStyle}
            />
          </>
        }
      />

      {emptyMessage ? (
        emptyWithCta ? (
          <EmptyTabState message={emptyMessage} />
        ) : (
          <QuietText variant="bodyLarge" style={styles.empty}>
            {emptyMessage}
          </QuietText>
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
            const nextPeers = nextIds.filter((id) => reorderPeerSet.has(id));
            return reorderHabitToOrder(nextPeers).catch((error) => {
              Alert.alert(
                tCommon('alerts.couldNotSave'),
                error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
              );
              throw error;
            });
          }}
          renderItem={renderHabit}
        />
      )}
    </HomeTabScrollView>
      {editorHost}
      <UndoSnackbar
        message={pendingUndo?.message ?? null}
        onUndo={runUndo}
        onDismiss={() => setPendingUndo(null)}
      />
    </>
  );
}

const styles = homeTabScreenStyles;
const addButtonStyle = { margin: 0, width: 44, height: 44 };
