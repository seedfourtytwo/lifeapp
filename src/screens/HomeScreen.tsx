import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  BackHandler,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useDayRolloverRefresh } from '../hooks/useDayRolloverRefresh';
import { NoteEditorHost, useNoteEditorSession, type HomeNotebookChip } from '../notes';
import { useJournalNotebookStore } from '../store/journalNotebookStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import CountersScreen from './CountersScreen';
import HabitsScreen from './HabitsScreen';
import NutritionScreen from './NutritionScreen';
import TodosScreen from './TodosScreen';
import SettingsMenuScreen from './settings/SettingsMenuScreen';
import {
  HOME_DOCK_ITEMS,
  homeBackTarget,
  homeTabAtOffset,
  homeTabIndex,
  type HomeTab,
} from './home/homePager';

/** Throttle GPS refresh so foregrounding doesn't spam location. */
const GPS_REFRESH_MIN_MS = 3 * 60 * 60 * 1000;
let lastGpsRefreshAt = 0;

/**
 * One pager page. Inactive pages stay mounted (scroll position and state
 * survive tab switches) but are taken out of the touch and accessibility
 * trees so they cannot swallow gestures meant for the active tab.
 */
function HomePagerPage({
  active,
  width,
  height,
  children,
}: {
  active: boolean;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[styles.page, { width, height: height > 0 ? height : undefined }]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { decorations: deco, isCartoon } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const tabRef = useRef<HomeTab>('habits');
  /**
   * All five pages mount at startup and stay mounted, so a swipe never lands on
   * an empty page and each tab keeps its scroll position and state. Every Home
   * tab's list is bounded by design (Nutrition shows this week's plate, not the
   * catalogue; More is a fixed list of rows) — keep it that way, or this
   * becomes a cold-start cost.
   */
  const [tab, setTab] = useState<HomeTab>('habits');
  /**
   * The page More was entered from. Back on More returns there, which is what
   * popping the stack did when More was a pushed screen.
   */
  const moreOpenedFrom = useRef<HomeTab>('habits');
  const [pagerHeight, setPagerHeight] = useState(0);
  const [notebooks, setNotebooks] = useState<HomeNotebookChip[]>([]);
  /** Tracker note sheet open on the active Habits/Counters tab. */
  const [trackerNotesOpen, setTrackerNotesOpen] = useState(false);
  /** Row drag-reorder active — lock Habit↔Counter pager. */
  const [trackerDragActive, setTrackerDragActive] = useState(false);
  const now = useAppCalendarNow();
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const refreshWeather = useWeatherStore((s) => s.refresh);

  const reloadNotebooksStore = useJournalNotebookStore((s) => s.reload);

  const reloadTodayNotebooks = useCallback(async () => {
    const today = currentAppCalendarDate(now);
    try {
      await reloadNotebooksStore();
      const db = await getDatabase();
      const todayCounts = await dailyJournalRepo.getJournalChapterCountsOnDate(db, today);
      const rows = useJournalNotebookStore.getState().notebooks;
      setNotebooks(
        rows.map((notebook) => ({
          id: notebook.id,
          name: notebook.name,
          color: notebook.color,
          icon: notebook.icon,
          hasToday: (todayCounts.get(notebook.id) ?? 0) > 0,
          todayCount: todayCounts.get(notebook.id) ?? 0,
        })),
      );
    } catch {
      // Non-fatal — icons stay empty until next focus.
    }
  }, [now, reloadNotebooksStore]);

  const noteEditor = useNoteEditorSession({
    onSaved: (date, _body, target) => {
      if (target.kind !== 'journal') return;
      if (date !== currentAppCalendarDate(now)) return;
      void reloadTodayNotebooks();
    },
  });
  const journalOpen = noteEditor.session != null;

  // Refreshes on mount, whenever the journal sheet closes, and when the app
  // calendar day rolls over (`reloadTodayNotebooks` is keyed on `now`).
  useEffect(() => {
    if (journalOpen) return;
    void reloadTodayNotebooks();
  }, [journalOpen, reloadTodayNotebooks]);

  const notesSheetOpen = journalOpen || trackerNotesOpen;
  const pagerLocked = notesSheetOpen || trackerDragActive;

  useEffect(() => {
    // Inactive tab dismisses its sheet; clear the swipe lock until the active tab reports.
    setTrackerNotesOpen(false);
    setTrackerDragActive(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'more') moreOpenedFrom.current = tab;
  }, [tab]);

  useDayRolloverRefresh();

  useFocusEffect(
    useCallback(() => {
      void reloadTodayNotebooks();
    }, [reloadTodayNotebooks]),
  );

  useEffect(() => {
    if (!weatherWidgetEnabled) return;
    void refreshWeather({ force: false });
  }, [weatherWidgetEnabled, refreshWeather]);

  useEffect(() => {
    if (!weatherWidgetEnabled || weatherLocationMode !== 'device') return;

    const refreshGpsIfDue = () => {
      const nowMs = Date.now();
      if (nowMs - lastGpsRefreshAt < GPS_REFRESH_MIN_MS) {
        void refreshWeather({ force: false });
        return;
      }
      lastGpsRefreshAt = nowMs;
      void refreshWeather({ force: true, refreshGps: true });
    };

    refreshGpsIfDue();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refreshGpsIfDue();
    });
    return () => sub.remove();
  }, [weatherWidgetEnabled, weatherLocationMode, refreshWeather]);

  const activeColor = isCartoon
    ? theme.colors.onSecondaryContainer
    : theme.colors.primary;
  const activeBg = isCartoon
    ? theme.colors.secondaryContainer
    : theme.colors.primaryContainer;
  const quietColor = theme.colors.onSurfaceVariant;
  const topInset =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? (StatusBar.currentHeight ?? 28)
        : 0;

  const openTodayNotebook = async (
    notebookId: string,
    opts?: { dictate?: boolean },
  ) => {
    const today = currentAppCalendarDate(now);
    // The chips lag a notebook created moments ago (Nutrition's food journal),
    // so fall back to the store the creation already refreshed — otherwise the
    // sheet opens on a nameless, glyphless journal.
    const chip =
      notebooks.find((notebook) => notebook.id === notebookId) ??
      useJournalNotebookStore
        .getState()
        .notebooks.find((notebook) => notebook.id === notebookId);
    const openOpts = opts?.dictate ? { dictate: true } : undefined;
    void noteEditor.open(
      {
        kind: 'journal',
        notebookId,
        label: chip?.name,
        icon: chip?.icon,
      },
      today,
      openOpts,
    );
  };

  /**
   * Stable handlers for the pages. `openTodayNotebook` closes over `now`, the
   * chips and the editor session, so it is a fresh function every render — the
   * pages get these instead, or a memoised page (Nutrition) would re-render on
   * every tab change, which is the one thing its memo exists to prevent.
   */
  const openTodayNotebookRef = useRef(openTodayNotebook);
  openTodayNotebookRef.current = openTodayNotebook;

  const dictateTodayNotebook = useCallback(
    (notebookId: string) => void openTodayNotebookRef.current(notebookId, { dictate: true }),
    [],
  );
  const editTodayNotebook = useCallback(
    (notebookId: string) => void openTodayNotebookRef.current(notebookId),
    [],
  );
  const handleNotebooksChanged = useCallback(() => {
    void reloadTodayNotebooks();
  }, [reloadTodayNotebooks]);

  const scrollToTab = useCallback(
    (next: HomeTab, animated = true) => {
      pagerRef.current?.scrollTo({ x: homeTabIndex(next) * pageWidth, animated });
      tabRef.current = next;
      setTab(next);
    },
    [pageWidth],
  );

  const onPagerMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = homeTabAtOffset(event.nativeEvent.contentOffset.x, pageWidth);
    if (next !== tabRef.current) {
      tabRef.current = next;
      setTab(next);
    }
  };

  // Keep pager aligned if window width changes (rotation / fold).
  useEffect(() => {
    pagerRef.current?.scrollTo({ x: homeTabIndex(tabRef.current) * pageWidth, animated: false });
  }, [pageWidth]);

  /**
   * Hardware back. Only More claims it — it swipes back to the page it was
   * opened from, the way popping the stack used to. Everything else falls
   * through to the navigator, so back from a content page still leaves the app
   * and back from a pushed screen (Trackers, Settings…) still pops it: this
   * listener is registered only while Home is the focused screen, and a later
   * listener is asked first, so returning false hands the press straight back.
   */
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        const target = homeBackTarget(tabRef.current, moreOpenedFrom.current);
        if (target == null) return false;
        scrollToTab(target);
        return true;
      });
      return () => sub.remove();
    }, [scrollToTab]),
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.content, { paddingTop: topInset }]}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!pagerLocked}
          onMomentumScrollEnd={onPagerMomentumEnd}
          scrollEventThrottle={16}
          style={styles.pager}
          /**
           * Measured here rather than on the padded view above: a view reports
           * its own padding as part of its height, so measuring that one made
           * every page a status bar taller than the room it had — the bottom of
           * each tab ended up under the dock, and its list bounced instead of
           * scrolling because it believed the content already fitted.
           */
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && nextHeight !== pagerHeight) {
              setPagerHeight(nextHeight);
            }
          }}
        >
          <HomePagerPage active={tab === 'habits'} width={pageWidth} height={pagerHeight}>
            <HabitsScreen
              notebooks={notebooks}
              onDictateNotebook={dictateTodayNotebook}
              onEditNotebook={editTodayNotebook}
              journalOpen={journalOpen}
              notesActive={tab === 'habits'}
              onBeforeOpenTrackerNote={noteEditor.dismiss}
              onTrackerNotesOpenChange={setTrackerNotesOpen}
              onTrackerDragActiveChange={setTrackerDragActive}
            />
          </HomePagerPage>
          <HomePagerPage active={tab === 'counters'} width={pageWidth} height={pagerHeight}>
            <CountersScreen
              notebooks={notebooks}
              onDictateNotebook={dictateTodayNotebook}
              onEditNotebook={editTodayNotebook}
              journalOpen={journalOpen}
              notesActive={tab === 'counters'}
              onBeforeOpenTrackerNote={noteEditor.dismiss}
              onTrackerNotesOpenChange={setTrackerNotesOpen}
              onTrackerDragActiveChange={setTrackerDragActive}
            />
          </HomePagerPage>
          <HomePagerPage active={tab === 'nutrition'} width={pageWidth} height={pagerHeight}>
            <NutritionScreen
              notebooks={notebooks}
              onDictateNotebook={dictateTodayNotebook}
              onEditNotebook={editTodayNotebook}
              onNotebooksChanged={handleNotebooksChanged}
            />
          </HomePagerPage>
          <HomePagerPage active={tab === 'todos'} width={pageWidth} height={pagerHeight}>
            <TodosScreen onTrackerDragActiveChange={setTrackerDragActive} />
          </HomePagerPage>
          <HomePagerPage active={tab === 'more'} width={pageWidth} height={pagerHeight}>
            <SettingsMenuScreen />
          </HomePagerPage>
        </ScrollView>
      </View>

      <View
        style={[
          styles.dock,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.outlineVariant,
            borderTopWidth: deco.headerBorderWidth > 0 ? deco.headerBorderWidth : StyleSheet.hairlineWidth,
          },
        ]}
      >
        {HOME_DOCK_ITEMS.map(({ value, labelKey, icon }) => {
          const active = tab === value;
          const color = active ? activeColor : quietColor;
          const label = t(labelKey);
          return (
            <Pressable
              key={value}
              onPress={() => scrollToTab(value)}
              style={[
                styles.dockItem,
                active && {
                  backgroundColor: activeBg,
                  borderRadius: deco.tabRadius,
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <MaterialCommunityIcons name={icon} size={active ? 26 : 24} color={color} />
            </Pressable>
          );
        })}
      </View>

      <NoteEditorHost session={noteEditor} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 44,
  },
});
