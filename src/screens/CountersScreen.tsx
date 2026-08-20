import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { CounterConfigSchema, type CounterConfig } from '../protocol';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import {
  refreshAllCounterData,
  useRefreshCounterTotalsOnFocus,
} from '../hooks/useCounterDataRefresh';
import { useTodayTrackerNotes } from '../hooks/useTodayTrackerNotes';
import { getKindHandler } from '../kinds/registry';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import type { HomeNotebookChip } from '../notes';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { getActiveCounters } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import EmptyTabState from './shared/EmptyTabState';
import HomeTabDayStatus from './shared/HomeTabDayStatus';
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
  journalOpen?: boolean;
  /** False while another Home tab is active — dismisses this screen's tracker note sheet. */
  notesActive?: boolean;
  onBeforeOpenTrackerNote?: () => void;
  /** Lets Home lock Habit↔Counter swipe while this tab's note sheet is open. */
  onTrackerNotesOpenChange?: (open: boolean) => void;
  /** Lets Home lock Habit↔Counter swipe while dragging to reorder. */
  onTrackerDragActiveChange?: (active: boolean) => void;
};

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
  const { notesToday, reloadNotesToday, applySaved } = useTodayTrackerNotes(counterIds, now);

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
  const journalMeta = (
    <HomeTabMetaRow
      notebooks={notebooks}
      onDictateNotebook={onDictateNotebook}
      onEditNotebook={onEditNotebook}
    />
  );

  if (isLoading && elements.length === 0 && !error) {
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

  if (counters.length > 0 && !counterTotalsReady && !error) {
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

        <HomeTabMetaRow
          notebooks={notebooks}
          onDictateNotebook={onDictateNotebook}
          onEditNotebook={onEditNotebook}
          leading={counters.length > 0 ? <HomeTabDayStatus now={now} /> : null}
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

const styles = {
  ...homeTabScreenStyles,
  ...StyleSheet.create({
    loadingPane: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
  }),
};
