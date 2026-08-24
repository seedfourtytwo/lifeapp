import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import HomeChromeBubble from '../components/HomeChromeBubble';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useDayRolloverRefresh } from '../hooks/useDayRolloverRefresh';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditorHost, useNoteEditorSession, type HomeNotebookChip } from '../notes';
import { useJournalNotebookStore } from '../store/journalNotebookStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import CountersScreen from './CountersScreen';
import HabitsScreen from './HabitsScreen';
import NutritionScreen from './NutritionScreen';
import TodosScreen from './TodosScreen';

type HomeTab = 'habits' | 'counters' | 'nutrition' | 'todos';

type DockIconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Throttle GPS refresh so foregrounding doesn't spam location. */
const GPS_REFRESH_MIN_MS = 3 * 60 * 60 * 1000;
let lastGpsRefreshAt = 0;

const TAB_ORDER: HomeTab[] = ['habits', 'counters', 'nutrition', 'todos'];

type DockTabLabelKey =
  | 'dock.habitsTab'
  | 'dock.countersTab'
  | 'dock.nutritionTab'
  | 'dock.todosTab';

const TABS: { value: HomeTab; labelKey: DockTabLabelKey; icon: DockIconName }[] = [
  { value: 'habits', labelKey: 'dock.habitsTab', icon: 'calendar-check' },
  { value: 'counters', labelKey: 'dock.countersTab', icon: 'counter' },
  { value: 'nutrition', labelKey: 'dock.nutritionTab', icon: 'cake-variant' },
  { value: 'todos', labelKey: 'dock.todosTab', icon: 'format-list-checks' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { decorations: deco, isCartoon } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const pagerRef = useRef<ScrollView>(null);
  const tabRef = useRef<HomeTab>('habits');
  const [tab, setTab] = useState<HomeTab>('habits');
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
      const todayIds = await dailyJournalRepo.getNotebookIdsWithJournalsOnDate(db, today);
      const rows = useJournalNotebookStore.getState().notebooks;
      setNotebooks(
        rows.map((notebook) => ({
          id: notebook.id,
          name: notebook.name,
          color: notebook.color,
          icon: notebook.icon,
          hasToday: todayIds.has(notebook.id),
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

  useDayRolloverRefresh();

  useFocusEffect(
    useCallback(() => {
      void reloadTodayNotebooks();
    }, [reloadTodayNotebooks]),
  );

  useEffect(() => {
    void reloadTodayNotebooks();
  }, [reloadTodayNotebooks]);

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

  const showChrome = weatherWidgetEnabled;
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
    const chip = notebooks.find((notebook) => notebook.id === notebookId);
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

  const scrollToTab = (next: HomeTab, animated = true) => {
    const index = TAB_ORDER.indexOf(next);
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated });
    tabRef.current = next;
    setTab(next);
  };

  const onPagerMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / Math.max(pageWidth, 1));
    const next = TAB_ORDER[Math.min(Math.max(index, 0), TAB_ORDER.length - 1)] ?? 'habits';
    if (next !== tabRef.current) {
      tabRef.current = next;
      setTab(next);
    }
  };

  // Keep pager aligned if window width changes (rotation / fold).
  useEffect(() => {
    const index = TAB_ORDER.indexOf(tabRef.current);
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated: false });
  }, [pageWidth]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View
        style={[styles.content, { paddingTop: topInset }]}
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          if (nextHeight > 0 && nextHeight !== pagerHeight) {
            setPagerHeight(nextHeight);
          }
        }}
      >
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
        >
          <View
            style={[
              styles.page,
              { width: pageWidth, height: pagerHeight > 0 ? pagerHeight : undefined },
            ]}
            pointerEvents={tab === 'habits' ? 'auto' : 'none'}
            accessibilityElementsHidden={tab !== 'habits'}
            importantForAccessibility={
              tab === 'habits' ? 'auto' : 'no-hide-descendants'
            }
          >
            <HabitsScreen
              notebooks={notebooks}
              onDictateNotebook={(id) => void openTodayNotebook(id, { dictate: true })}
              onEditNotebook={(id) => void openTodayNotebook(id)}
              journalOpen={journalOpen}
              notesActive={tab === 'habits'}
              onBeforeOpenTrackerNote={noteEditor.dismiss}
              onTrackerNotesOpenChange={setTrackerNotesOpen}
              onTrackerDragActiveChange={setTrackerDragActive}
            />
          </View>
          <View
            style={[
              styles.page,
              { width: pageWidth, height: pagerHeight > 0 ? pagerHeight : undefined },
            ]}
            pointerEvents={tab === 'counters' ? 'auto' : 'none'}
            accessibilityElementsHidden={tab !== 'counters'}
            importantForAccessibility={
              tab === 'counters' ? 'auto' : 'no-hide-descendants'
            }
          >
            <CountersScreen
              notebooks={notebooks}
              onDictateNotebook={(id) => void openTodayNotebook(id, { dictate: true })}
              onEditNotebook={(id) => void openTodayNotebook(id)}
              journalOpen={journalOpen}
              notesActive={tab === 'counters'}
              onBeforeOpenTrackerNote={noteEditor.dismiss}
              onTrackerNotesOpenChange={setTrackerNotesOpen}
              onTrackerDragActiveChange={setTrackerDragActive}
            />
          </View>
          <View
            style={[
              styles.page,
              { width: pageWidth, height: pagerHeight > 0 ? pagerHeight : undefined },
            ]}
            pointerEvents={tab === 'nutrition' ? 'auto' : 'none'}
            accessibilityElementsHidden={tab !== 'nutrition'}
            importantForAccessibility={
              tab === 'nutrition' ? 'auto' : 'no-hide-descendants'
            }
          >
            <NutritionScreen />
          </View>
          <View
            style={[
              styles.page,
              { width: pageWidth, height: pagerHeight > 0 ? pagerHeight : undefined },
            ]}
            pointerEvents={tab === 'todos' ? 'auto' : 'none'}
            accessibilityElementsHidden={tab !== 'todos'}
            importantForAccessibility={tab === 'todos' ? 'auto' : 'no-hide-descendants'}
          >
            <TodosScreen onTrackerDragActiveChange={setTrackerDragActive} />
          </View>
        </ScrollView>
      </View>

      {showChrome ? <HomeChromeBubble /> : null}

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
        {TABS.map(({ value, labelKey, icon }) => {
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

        <Pressable
          onPress={() => navigation.navigate('SettingsMenu')}
          style={styles.dockItem}
          accessibilityRole="button"
          accessibilityLabel={t('dock.more')}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={quietColor} />
        </Pressable>
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
