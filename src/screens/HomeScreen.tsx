import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Text, useTheme } from 'react-native-paper';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import { useDayRolloverRefresh } from '../hooks/useDayRolloverRefresh';
import { useTodayNotebooks } from '../hooks/useTodayNotebooks';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditorHost } from '../notes';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import CalendarScreen from './CalendarScreen';
import JournalScreen from './JournalScreen';
import MoreScreen from './settings/MoreScreen';
import { HomePagerContext, type HomePagerContextValue } from './home/HomePagerContext';
import {
  HOME_DOCK_ITEMS,
  HOME_PAGES_AT_START,
  homeBackTarget,
  homePagesAfterDragStart,
  homePagesAfterVisit,
  homeTabAtOffset,
  homeTabIndex,
  type HomeTab,
} from './home/homePager';
import { loadHomeStartTab, saveHomeTab } from './home/homeLastTab';
import ReviewScreen from './ReviewScreen';
import TodayScreen from './TodayScreen';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

/**
 * How far a dock label follows the system font. One of the few capped texts:
 * five words share one row whose width is the screen's, so past this they
 * could only collide. The label shrinks to its slot and stays on one line.
 */
const DOCK_LABEL_MAX_FONT_SCALE = 1.3;

/** Throttle GPS refresh so foregrounding doesn't spam location. */
const GPS_REFRESH_MIN_MS = 3 * 60 * 60 * 1000;
let lastGpsRefreshAt = 0;

/**
 * One pager page. A page keeps its slot whether or not its screen has been
 * built yet: an unbuilt page is this view with nothing in it, the right size,
 * showing the ground Home paints behind the pager. Once built, a page stays
 * mounted (scroll position and state survive page switches) but while it is
 * off screen it is taken out of the touch and accessibility trees so it
 * cannot swallow gestures meant for the active page.
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
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const tabRef = useRef<HomeTab>('today');
  const [tab, setTab] = useState<HomeTab>('today');
  /**
   * Only Today is built at startup. Another page is built the first time it is
   * visited, or when a drag begins beside it, and then stays mounted so it
   * keeps its scroll position and state. See `homePagesAfterVisit` and
   * `homePagesAfterDragStart`.
   */
  const [mountedPages, setMountedPages] = useState(HOME_PAGES_AT_START);
  /**
   * The page More was entered from. Back on More returns there, which is what
   * popping the stack did when More was a pushed screen.
   */
  const moreOpenedFrom = useRef<HomeTab>('today');
  const [pagerHeight, setPagerHeight] = useState(0);
  /** Tracker note sheet open on the Today page. */
  const [trackerNotesOpen, setTrackerNotesOpen] = useState(false);
  /** Row drag-reorder active — hold the pager still. */
  const [trackerDragActive, setTrackerDragActive] = useState(false);
  /** A page's own sideways scroller has the finger — hold the pager still. */
  const [innerSwipeActive, setInnerSwipeActive] = useState(false);
  const route = useRoute<RouteProp<RootStackParamList, 'Home'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const refreshWeather = useWeatherStore((s) => s.refresh);

  const {
    notebooks,
    noteEditor,
    journalOpen,
    dictateNotebook: dictateTodayNotebook,
    editNotebook: editTodayNotebook,
  } = useTodayNotebooks();

  const notesSheetOpen = journalOpen || trackerNotesOpen;
  const pagerLocked = notesSheetOpen || trackerDragActive || innerSwipeActive;

  useEffect(() => {
    // A page left behind dismisses its sheet; clear the swipe locks until the active page reports.
    setTrackerNotesOpen(false);
    setTrackerDragActive(false);
    setInnerSwipeActive(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'more') moreOpenedFrom.current = tab;
  }, [tab]);

  useDayRolloverRefresh();

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

  const activeColor = palette.accent;
  const quietColor = theme.colors.onSurfaceVariant;
  const topInset =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? (StatusBar.currentHeight ?? 28)
        : 0;

  const scrollToTab = useCallback(
    (next: HomeTab, animated = true) => {
      pagerRef.current?.scrollTo({ x: homeTabIndex(next) * pageWidth, animated });
      tabRef.current = next;
      setTab(next);
      setMountedPages((mounted) => homePagesAfterVisit(mounted, next));
    },
    [pageWidth],
  );

  const onPagerDragStart = () => {
    setMountedPages((mounted) => homePagesAfterDragStart(mounted, tabRef.current));
  };

  const onPagerMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = homeTabAtOffset(event.nativeEvent.contentOffset.x, pageWidth);
    if (next !== tabRef.current) {
      tabRef.current = next;
      setTab(next);
    }
    setMountedPages((mounted) => homePagesAfterVisit(mounted, next));
  };

  /**
   * Reopen on the page used last — which builds it, beside Today — and never
   * after the user has moved the pager themselves.
   */
  const startTabApplied = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void loadHomeStartTab().then((start) => {
      if (cancelled || startTabApplied.current) return;
      startTabApplied.current = true;
      if (start !== tabRef.current) scrollToTab(start, false);
    });
    return () => {
      cancelled = true;
    };
  }, [scrollToTab]);

  useEffect(() => {
    if (!startTabApplied.current) {
      // The first page shown is the default; a real move cancels the restore.
      if (tab === 'today') return;
      startTabApplied.current = true;
    }
    saveHomeTab(tab);
  }, [tab]);

  /**
   * A pushed screen sent the user to a page (`useGoToHomeTab`): it popped back
   * to Home with the page in the route params. Go there, then clear the param
   * so coming back to Home later does not go there again.
   */
  const requestedTab = route.params?.tab;
  useEffect(() => {
    if (requestedTab == null) return;
    startTabApplied.current = true;
    scrollToTab(requestedTab, false);
    navigation.setParams({ tab: undefined });
  }, [requestedTab, scrollToTab, navigation]);

  const pager = useMemo<HomePagerContextValue>(
    () => ({
      activeTab: tab,
      goToTab: (next) => scrollToTab(next),
      setSwipeLocked: setInnerSwipeActive,
    }),
    [tab, scrollToTab],
  );

  // Keep pager aligned if window width changes (rotation / fold).
  useEffect(() => {
    pagerRef.current?.scrollTo({ x: homeTabIndex(tabRef.current) * pageWidth, animated: false });
  }, [pageWidth]);

  /**
   * Hardware back. More swipes back to the page it was opened from; the other
   * pages step back to Today; only Today falls through to the navigator and
   * leaves the app. Back from a pushed screen (Trackers, Food…) still pops it:
   * this listener is registered only while Home is the focused screen, and a
   * later listener is asked first, so returning false hands the press straight
   * back.
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
    <HomePagerContext.Provider value={pager}>
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
            onScrollBeginDrag={onPagerDragStart}
            onMomentumScrollEnd={onPagerMomentumEnd}
            scrollEventThrottle={16}
            style={styles.pager}
            /**
             * Measured here rather than on the padded view above: a view reports
             * its own padding as part of its height, so measuring that one made
             * every page a status bar taller than the room it had — the bottom of
             * each page ended up under the dock, and its list bounced instead of
             * scrolling because it believed the content already fitted.
             */
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight > 0 && nextHeight !== pagerHeight) {
                setPagerHeight(nextHeight);
              }
            }}
          >
            <HomePagerPage active={tab === 'today'} width={pageWidth} height={pagerHeight}>
              <TodayScreen
                notebooks={notebooks}
                onDictateNotebook={dictateTodayNotebook}
                onEditNotebook={editTodayNotebook}
                journalOpen={journalOpen}
                notesActive={tab === 'today'}
                onBeforeOpenTrackerNote={noteEditor.dismiss}
                onTrackerNotesOpenChange={setTrackerNotesOpen}
                onTrackerDragActiveChange={setTrackerDragActive}
              />
            </HomePagerPage>
            <HomePagerPage active={tab === 'journal'} width={pageWidth} height={pagerHeight}>
              {mountedPages.has('journal') ? <JournalScreen active={tab === 'journal'} /> : null}
            </HomePagerPage>
            <HomePagerPage active={tab === 'calendar'} width={pageWidth} height={pagerHeight}>
              {mountedPages.has('calendar') ? <CalendarScreen /> : null}
            </HomePagerPage>
            <HomePagerPage active={tab === 'review'} width={pageWidth} height={pagerHeight}>
              {mountedPages.has('review') ? <ReviewScreen active={tab === 'review'} /> : null}
            </HomePagerPage>
            <HomePagerPage active={tab === 'more'} width={pageWidth} height={pagerHeight}>
              {mountedPages.has('more') ? <MoreScreen /> : null}
            </HomePagerPage>
          </ScrollView>
        </View>

        <View
          style={[
            styles.dock,
            {
              paddingBottom: Math.max(insets.bottom, 8),
              // The dock is part of the page, not a bar laid over it: same ground,
              // no rule above.
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          {HOME_DOCK_ITEMS.map(({ value, labelKey, icon, activeIcon }) => {
            const active = tab === value;
            const color = active ? activeColor : quietColor;
            const label = t(labelKey);
            return (
              <Pressable
                key={value}
                onPress={() => scrollToTab(value)}
                style={styles.dockItem}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
              >
                <MaterialCommunityIcons name={active ? activeIcon : icon} size={24} color={color} />
                <Text
                  style={[typeScale.caption, styles.dockLabel, { color }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  maxFontSizeMultiplier={DOCK_LABEL_MAX_FONT_SCALE}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <NoteEditorHost session={noteEditor} />
      </View>
    </HomePagerContext.Provider>
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
    paddingTop: space.xs,
    // Tight to the edges: the widest label needs every point of its slot.
    paddingHorizontal: space.xs,
  },
  dockItem: {
    flex: 1,
    // Lets the label shrink to the slot instead of widening it.
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    minHeight: 48,
  },
  dockLabel: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
});
