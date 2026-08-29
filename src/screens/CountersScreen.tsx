import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { CounterConfigSchema, type CounterConfig } from '../protocol';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { ACTIVITY_DAYS, useRecentActivity } from '../hooks/useRecentActivity';
import { refreshAllCounterData } from '../hooks/refreshAllDailyData';
import { useRefreshCounterTotalsOnFocus } from '../hooks/useCounterDataRefresh';
import { getKindHandler } from '../kinds/registry';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditorHost } from '../notes';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { getActiveCounters } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
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
  const { dailyTotals, counterStreaks, logEvent, setDailyTotal, counterTotalsReady } =
    useEventStore(
      useShallow((s) => ({
        dailyTotals: s.dailyTotals,
        counterStreaks: s.counterStreaks,
        logEvent: s.logEvent,
        setDailyTotal: s.setDailyTotal,
        counterTotalsReady: s.counterTotalsReady,
      })),
    );
  const now = useAppCalendarNow();
  const [scrollLocked, setScrollLocked] = useState(false);
  const scrollRef = useRef<HomeTabScrollViewHandle>(null);

  useEffect(() => {
    if (notesActive) return;
    setScrollLocked(false);
  }, [notesActive]);

  useRefreshCounterTotalsOnFocus();

  const counters = useMemo(
    () => getActiveCounters(elements, dashboard),
    [elements, dashboard],
  );

  const counterIds = useMemo(() => counters.map((c) => c.id), [counters]);
  const activity = useRecentActivity(counterIds);

  /**
   * Counters have no notion of "done", so the header counts how many were
   * touched today and shows the best streak running against a daily target.
   */
  const headerMeta = useMemo(() => {
    if (counters.length === 0) return null;
    const logged = counters.filter((c) => (dailyTotals[c.id] ?? 0) > 0).length;
    const parts = [
      logged === 0
        ? t('dayHeader.countersNone')
        : t('dayHeader.countersLogged', { count: logged }),
    ];
    const bestStreak = counters.reduce(
      (best, counter) => Math.max(best, counterStreaks[counter.id] ?? 0),
      0,
    );
    if (bestStreak > 0) parts.push(t('dayHeader.streak', { count: bestStreak }));
    return parts.join(t('dayHeader.separator'));
  }, [counters, dailyTotals, counterStreaks, t]);

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

  const reload = useCallback(async () => {
    await refreshAllCounterData();
    await reloadNotesToday();
  }, [reloadNotesToday]);

  const editorHost = <NoteEditorHost session={noteEditor} />;

  // Wait for elements, then for today's totals — a +1 before totals land would
  // render against a stale base.
  const waitingForData =
    (isLoading && elements.length === 0) || (counters.length > 0 && !counterTotalsReady);
  if (waitingForData && !error) {
    return (
      <>
        <HomeTabLoadingPane
          notebooks={notebooks}
          onDictateNotebook={onDictateNotebook}
          onEditNotebook={onEditNotebook}
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
            renderItem={(id, drag) => {
              const element = counterById.get(id);
              if (!element) return null;
              const handler = getKindHandler(element.kind);
              if (!handler) return null;
              const Widget = handler.DashboardWidget;
              const config = counterConfigs.get(element.id);
              if (!config) return null;
              const canReorder = drag.canDrag;

              return (
                <Widget
                  element={element}
                  config={config}
                  todayTotal={dailyTotals[element.id] ?? 0}
                  streak={counterStreaks[element.id] ?? 0}
                  onLongPressReorder={canReorder ? drag.onLongPress : undefined}
                  delayLongPressReorder={drag.delayLongPress}
                  onReorderTouchMove={canReorder ? drag.onTouchMove : undefined}
                  onReorderTouchEnd={canReorder ? drag.onTouchEnd : undefined}
                  onReorderTouchCancel={canReorder ? drag.onTouchCancel : undefined}
                  reorderHint={
                    canReorder
                      ? tTrackers('counterWidget.reorderLongPressHint')
                      : undefined
                  }
                  onLog={(value, meta) =>
                    logEvent(element.id, value, meta).catch((err) => {
                      Alert.alert(
                        tCommon('alerts.couldNotLog'),
                        err instanceof Error ? err.message : t('countersTab.couldNotLogBody'),
                      );
                    })
                  }
                  onSetDailyTotal={async (total) => {
                    await setDailyTotal(element.id, total);
                  }}
                  onOpenDetails={() =>
                    navigation.navigate('TrackerHistory', { elementId: element.id })
                  }
                  hasTodayNote={notesToday.has(element.id)}
                  onDictateNote={() => {
                    onBeforeOpenTrackerNote?.();
                    void noteEditor.open(
                      { kind: 'tracker', elementId: element.id, label: element.name },
                      currentAppCalendarDate(now),
                      { dictate: true },
                    );
                  }}
                  onEditNote={() => {
                    onBeforeOpenTrackerNote?.();
                    void noteEditor.open(
                      { kind: 'tracker', elementId: element.id, label: element.name },
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
