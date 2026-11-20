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
import { Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useDayRolloverRefresh } from '../hooks/useDayRolloverRefresh';
import { useTodayNotebooks } from '../hooks/useTodayNotebooks';
import { NoteEditorHost } from '../notes';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import JournalScreen from './JournalScreen';
import MoreScreen from './settings/MoreScreen';
import { HomePagerContext, type HomePagerContextValue } from './home/HomePagerContext';
import {
  HOME_PAGES_AT_START,
  HOME_TAB_ORDER,
  homeBackTarget,
  homePagesAfterDragStart,
  homePagesAfterVisit,
  homeTabAtOffset,
  homeTabIndex,
  type HomeTab,
} from './home/homePager';
import { loadHomeStartTab, saveHomeTab } from './home/homeLastTab';
import TodayScreen from './TodayScreen';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

/**
 * How far a dock word follows the system font. One of the few capped texts:
 * the words share one row whose width is the screen's, so past this they
 * could only collide. The word shrinks to its slot and stays on one line.
 */
const DOCK_LABEL_MAX_FONT_SCALE = 1.3;

/** The dash under the current page's word. */
const DOCK_DASH_WIDTH = 18;
const DOCK_DASH_HEIGHT = 3;

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

  const pager = useMemo<HomePagerContextValue>(
    () => ({ setSwipeLocked: setInnerSwipeActive }),
    [],
  );

  // Keep pager aligned if window width changes (rotation / fold).
  useEffect(() => {
    pagerRef.current?.scrollTo({ x: homeTabIndex(tabRef.current) * pageWidth, animated: false });
  }, [pageWidth]);

  /**
   * Hardware back. More swipes back to the page it was opened from; the
   * Journal steps back to Today; only Today falls through to the navigator and
   * leaves the app. Back from a pushed screen (Calendar, Review…) still pops it:
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
          {HOME_TAB_ORDER.map((value) => {
            const active = tab === value;
            const label = t(`dock.${value}`);
            return (
              <Pressable
                key={value}
                onPress={() => scrollToTab(value)}
                style={styles.dockItem}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
              >
                <Text
                  style={[
                    typeScale.dockWord,
                    styles.dockLabel,
                    active
                      ? [styles.dockLabelActive, { color: theme.colors.onSurface }]
                      : { color: theme.colors.onSurfaceVariant },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  maxFontSizeMultiplier={DOCK_LABEL_MAX_FONT_SCALE}
                >
                  {label}
                </Text>
                {/* Always laid out, so the word does not move when its page is chosen. */}
                <View
                  style={[styles.dockDash, active && { backgroundColor: theme.colors.primary }]}
                />
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
    paddingHorizontal: space.xs,
  },
  dockItem: {
    flex: 1,
    // Lets the word shrink to the slot instead of widening it.
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 48,
  },
  dockLabel: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  dockLabelActive: {
    fontWeight: '500',
  },
  dockDash: {
    width: DOCK_DASH_WIDTH,
    height: DOCK_DASH_HEIGHT,
    // Geometric: half the height is what makes it a capsule.
    borderRadius: DOCK_DASH_HEIGHT / 2,
  },
});
