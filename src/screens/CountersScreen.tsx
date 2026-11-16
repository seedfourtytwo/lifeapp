import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CounterConfigSchema, type CounterConfig, type ElementDefinition } from '../protocol';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { ACTIVITY_DAYS, useRecentActivity } from '../hooks/useRecentActivity';
import { refreshAllCounterData } from '../hooks/refreshAllDailyData';
import { useRefreshCounterTotalsOnFocus } from '../hooks/useCounterDataRefresh';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditorHost } from '../notes';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { nextCounterUndo, type CounterUndo } from '../utils/counterUndo';
import { getActiveCounters } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import CounterCard from './counters/CounterCard';
import EmptyTabState from './shared/EmptyTabState';
import DayHeader from './shared/DayHeader';
import { counterHeaderMeta } from './shared/dayHeaderMeta';
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

export default function CountersScreen({
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dashboard = useElementStore((s) => s.dashboard);
  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const reorderCounterToOrder = useElementStore((s) => s.reorderCounterToOrder);
  const logEvent = useEventStore((s) => s.logEvent);
  const setDailyTotal = useEventStore((s) => s.setDailyTotal);
  const adjustDailyTotal = useEventStore((s) => s.adjustDailyTotal);
  const counterTotalsReady = useEventStore((s) => s.counterTotalsReady);
  const now = useAppCalendarNow();
  const [scrollLocked, setScrollLocked] = useState(false);
  const [counterUndo, setCounterUndo] = useState<CounterUndo | null>(null);
  const scrollRef = useRef<HomeTabScrollViewHandle>(null);

  useEffect(() => {
    if (notesActive) return;
    setScrollLocked(false);
    // Undo belongs to the page it was offered on; leaving the page settles it.
    setCounterUndo(null);
  }, [notesActive]);

  useRefreshCounterTotalsOnFocus();

  const counters = useMemo(
    () => getActiveCounters(elements, dashboard),
    [elements, dashboard],
  );

  const counterIds = useMemo(() => counters.map((c) => c.id), [counters]);
  const activity = useRecentActivity(counterIds);

  // Numbers, not the maps: a +1 (or a habit tick, which also writes
  // `dailyTotals`) re-renders this screen only when the header would change.
  const loggedCount = useEventStore((s) =>
    counterIds.reduce((n, id) => ((s.dailyTotals[id] ?? 0) > 0 ? n + 1 : n), 0),
  );
  const bestStreak = useEventStore((s) =>
    counterIds.reduce((best, id) => Math.max(best, s.counterStreaks[id] ?? 0), 0),
  );

  /**
   * Counters have no notion of "done", so the header counts how many were
   * touched today and shows the best streak running against a daily target.
   */
  const headerMeta = useMemo(() => {
    if (counters.length === 0) return null;
    return counterHeaderMeta({ logged: loggedCount, bestStreak });
  }, [counters.length, loggedCount, bestStreak]);

  const activityLabel = useMemo(
    () =>
      t('dayHeader.activityA11y', {
        days: ACTIVITY_DAYS,
        count: activity.filter((day) => day.active).length,
      }),
    [activity, t],
  );
  const { notesToday, reloadNotesToday, noteEditor } = useHomeTrackerNotes({
    elementIds: counterIds,
    now,
    journalOpen,
    notesActive,
    onTrackerNotesOpenChange,
  });

  const counterConfigs = useMemo(() => {
    const configs = new Map<string, CounterConfig>();
    for (const element of counters) {
      configs.set(element.id, CounterConfigSchema.parse(element.config));
    }
    return configs;
  }, [counters]);

  const counterById = useMemo(() => {
    const map = new Map(counters.map((element) => [element.id, element]));
    return map;
  }, [counters]);

  const undoLastTaps = () => {
    const pending = counterUndo;
    setCounterUndo(null);
    if (!pending) return;
    // Take back what the burst added, from what SQLite holds now — not back to
    // the total seen before it, which would erase another writer's entries.
    adjustDailyTotal(pending.elementId, -pending.added).catch((err) => {
      Alert.alert(
        tCommon('alerts.couldNotSave'),
        err instanceof Error ? err.message : tCommon('errors.somethingWentWrong'),
      );
    });
  };

  const reload = useCallback(async () => {
    await refreshAllCounterData();
    await reloadNotesToday();
  }, [reloadNotesToday]);

  // Stable callbacks for the memoised cards; the latest values ride on a ref.
  const latest = useRef({ noteEditor, now, onBeforeOpenTrackerNote, navigation, t, tCommon });
  latest.current = { noteEditor, now, onBeforeOpenTrackerNote, navigation, t, tCommon };

  const handleLog = useCallback(
    (element: ElementDefinition, value: number, meta?: Record<string, unknown>) => {
      const before = useEventStore.getState().dailyTotals[element.id] ?? 0;
      return logEvent(element.id, value, meta)
        .then(() =>
          setCounterUndo((prev) =>
            nextCounterUndo(prev, {
              elementId: element.id,
              name: element.name,
              before,
              added: value,
            }),
          ),
        )
        .catch((err) => {
          const { t: tHome, tCommon: tC } = latest.current;
          Alert.alert(
            tC('alerts.couldNotLog'),
            err instanceof Error ? err.message : tHome('countersTab.couldNotLogBody'),
          );
        });
    },
    [logEvent],
  );

  const handleSetDailyTotal = useCallback(
    async (element: ElementDefinition, total: number) => {
      await setDailyTotal(element.id, total);
      // An exact total supersedes the taps the pending Undo would take back.
      setCounterUndo((prev) => (prev?.elementId === element.id ? null : prev));
    },
    [setDailyTotal],
  );

  const handleOpenDetails = useCallback((element: ElementDefinition) => {
    latest.current.navigation.navigate('TrackerHistory', { elementId: element.id });
  }, []);

  const handleOpenNote = useCallback((element: ElementDefinition, dictate: boolean) => {
    const { noteEditor: editor, now: at, onBeforeOpenTrackerNote: beforeOpen } = latest.current;
    beforeOpen?.();
    void editor.open(
      { kind: 'tracker', elementId: element.id, label: element.name },
      currentAppCalendarDate(at),
      dictate ? { dictate: true } : undefined,
    );
  }, []);

  const reorderHint = tTrackers('counterWidget.reorderLongPressHint');
  const renderCounter = useCallback(
    (id: string, drag: DraggableRenderContext) => {
      const element = counterById.get(id);
      if (!element) return null;
      const config = counterConfigs.get(element.id);
      if (!config) return null;
      const canReorder = drag.canDrag;

      return (
        <CounterCard
          element={element}
          config={config}
          onLongPressReorder={canReorder ? drag.onLongPress : undefined}
          delayLongPressReorder={drag.delayLongPress}
          onReorderTouchMove={canReorder ? drag.onTouchMove : undefined}
          onReorderTouchEnd={canReorder ? drag.onTouchEnd : undefined}
          onReorderTouchCancel={canReorder ? drag.onTouchCancel : undefined}
          reorderHint={canReorder ? reorderHint : undefined}
          onLog={handleLog}
          onSetDailyTotal={handleSetDailyTotal}
          onOpenDetails={handleOpenDetails}
          hasTodayNote={notesToday.has(element.id)}
          onOpenNote={handleOpenNote}
        />
      );
    },
    [
      counterById,
      counterConfigs,
      handleLog,
      handleOpenDetails,
      handleOpenNote,
      handleSetDailyTotal,
      notesToday,
      reorderHint,
    ],
  );

  const editorHost = <NoteEditorHost session={noteEditor} />;

  // Wait for elements, then for today's totals — a +1 before totals land would
  // render against a stale base.
  const waitingForData =
    (isLoading && elements.length === 0) || (counters.length > 0 && !counterTotalsReady);
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
              {t('countersTab.retry')}
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

        {counters.length === 0 ? (
          <EmptyTabState
            message={
              elements.some((e) => e.kind === 'counter')
                ? t('countersTab.emptyNoActiveCounters')
                : t('countersTab.emptyNoCounters')
            }
          />
        ) : (
          <DraggableTrackerList
            itemIds={counterIds}
            scrollRef={scrollRef}
            onDragActiveChange={(active) => {
              setScrollLocked(active);
              onTrackerDragActiveChange?.(active);
            }}
            onReorder={(nextIds) =>
              reorderCounterToOrder(nextIds).catch((error) => {
                Alert.alert(
                  tCommon('alerts.couldNotSave'),
                  error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
                );
                throw error;
              })
            }
            renderItem={renderCounter}
          />
        )}
      </HomeTabScrollView>
      {editorHost}
      <UndoSnackbar
        message={
          counterUndo
            ? tTrackers('undo.counterAdded', { name: counterUndo.name, count: counterUndo.added })
            : null
        }
        onUndo={undoLastTaps}
        onDismiss={() => setCounterUndo(null)}
      />
    </>
  );
}

const styles = homeTabScreenStyles;
