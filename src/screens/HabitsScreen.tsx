import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { ACTIVITY_DAYS, useRecentActivity } from '../hooks/useRecentActivity';
import { refreshAllHabitData } from '../hooks/refreshAllDailyData';
import { useRefreshHabitDayOnFocus } from '../hooks/useHabitDataRefresh';
import { NoteEditorHost } from '../notes';
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
import DayHeader from './shared/DayHeader';
import HomeTabLoadingPane from './shared/HomeTabLoadingPane';
import NotebookButtons from './shared/NotebookButtons';
import { DraggableTrackerList } from './shared/DraggableTrackerList';
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
  const habitDoneToday = useEventStore((s) => s.habitDoneToday);
  const habitStreaks = useEventStore((s) => s.habitStreaks);
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

  // The strip covers every active habit, not only the ones due today — it is a
  // record of the fortnight, and a habit scheduled twice a week still counts.
  const allHabitIds = useMemo(() => allHabits.map((h) => h.id), [allHabits]);
  const activity = useRecentActivity(allHabitIds);

  /**
   * "3 of 5 done · 41-day streak". The streak shown is the best one running,
   * because the header answers "how am I doing", not "how is each habit doing".
   */
  const headerMeta = useMemo(() => {
    if (habits.length === 0) return t('dayHeader.habitsNoneDue');
    const done = habits.filter((habit) => habitDoneToday[habit.id] ?? false).length;
    const parts = [t('dayHeader.habitsDone', { done, total: habits.length })];
    const bestStreak = habits.reduce(
      (best, habit) => Math.max(best, habitStreaks[habit.id] ?? 0),
      0,
    );
    if (bestStreak > 0) parts.push(t('dayHeader.streak', { count: bestStreak }));
    return parts.join(t('dayHeader.separator'));
  }, [habits, habitDoneToday, habitStreaks, t]);

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
    () => habits.filter((habit) => !(habitDoneToday[habit.id] ?? false)).map((h) => h.id),
    [habits, habitDoneToday],
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
          <NotebookButtons
            notebooks={notebooks}
            onDictateNotebook={onDictateNotebook}
            onEditNotebook={onEditNotebook}
          />
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

const styles = homeTabScreenStyles;
