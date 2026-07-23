import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { getActiveCounters } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import ReorderControls from './shared/ReorderControls';
import EmptyTabState from './shared/EmptyTabState';
import HomeTabMetaRow from './shared/HomeTabMetaRow';
import { HomeTabScrollView } from './shared/HomeTabScrollView';
import { homeTabScreenStyles } from './shared/screenStyles';

type Props = {
  hasTodayJournal: boolean;
  onOpenJournal: () => void;
  onEditJournal?: () => void;
  journalOpen?: boolean;
  /** False while another Home tab is active — dismisses this screen's tracker note sheet. */
  notesActive?: boolean;
  onBeforeOpenTrackerNote?: () => void;
  /** Lets Home lock Habit↔Counter swipe while this tab's note sheet is open. */
  onTrackerNotesOpenChange?: (open: boolean) => void;
};

export default function CountersScreen({
  hasTodayJournal,
  onOpenJournal,
  onEditJournal,
  journalOpen = false,
  notesActive = true,
  onBeforeOpenTrackerNote,
  onTrackerNotesOpenChange,
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
  const reorderCounter = useElementStore((s) => s.reorderCounter);
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
  const [reordering, setReordering] = useState(false);
  const now = useAppCalendarNow();

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

  useEffect(() => {
    if (journalOpen || !notesActive) noteEditor.dismiss();
  }, [journalOpen, notesActive, noteEditor.dismiss]);

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

  const reload = useCallback(async () => {
    await refreshAllCounterData();
    await reloadNotesToday();
  }, [reloadNotesToday]);

  const editorHost = <NoteEditorHost session={noteEditor} />;
  const journalMeta = (
    <HomeTabMetaRow
      hasTodayJournal={hasTodayJournal}
      onOpenJournal={onOpenJournal}
      onEditJournal={onEditJournal}
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
      <HomeTabScrollView contentContainerStyle={styles.container}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
            <Button mode="outlined" onPress={() => void reload()}>
              {t('countersTab.retry')}
            </Button>
          </View>
        ) : null}

        <HomeTabMetaRow
          hasTodayJournal={hasTodayJournal}
          onOpenJournal={onOpenJournal}
          onEditJournal={onEditJournal}
          leading={
            counters.length > 0 ? (
              <Text variant="bodyMedium" numberOfLines={1}>
                {reordering
                  ? t('countersTab.moveWithArrows')
                  : t('countersTab.resetsAtMidnight')}
              </Text>
            ) : null
          }
          trailing={
            counters.length > 0 ? (
              reordering ? (
                <Button compact mode="text" onPress={() => setReordering(false)}>
                  {t('countersTab.done')}
                </Button>
              ) : (
                <Button
                  mode="text"
                  compact
                  icon="sort"
                  disabled={counters.length < 2}
                  onPress={() => setReordering(true)}
                >
                  {t('countersTab.sort')}
                </Button>
              )
            ) : null
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
          counters.map((element, index) => {
            const handler = getKindHandler(element.kind);
            if (!handler) return null;

            const Widget = handler.DashboardWidget;
            const config = counterConfigs.get(element.id);
            if (!config) return null;

            return (
              <View key={element.id} style={styles.reorderRow}>
                {reordering ? (
                  <ReorderControls
                    canMoveUp={index > 0}
                    canMoveDown={index < counters.length - 1}
                    onMoveUp={() => void reorderCounter(element.id, 'up')}
                    onMoveDown={() => void reorderCounter(element.id, 'down')}
                    accessibilityNoun={tTrackers('kindLabel.counter')}
                  />
                ) : null}
                <View style={styles.reorderCard}>
                  <Widget
                    element={element}
                    config={config}
                    todayTotal={dailyTotals[element.id] ?? 0}
                    streak={counterStreaks[element.id] ?? 0}
                    onLog={(value, meta) =>
                      logEvent(element.id, value, meta).catch((err) => {
                        Alert.alert(
                          tCommon('alerts.couldNotLog'),
                          err instanceof Error ? err.message : t('countersTab.couldNotLogBody'),
                        );
                      })
                    }
                    onSetDailyTotal={async (total) => {
                      // Errors surface in CounterWidget's edit sheet (avoid double Alert).
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
                </View>
              </View>
            );
          })
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
