import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EmptyState from '../components/EmptyState';
import SegmentedControl from '../components/SegmentedControl';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { getDateLocale } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { parseLocalDate, shiftDateString, weekStartDateString } from '../protocol';
import {
  bestWeekday,
  dayCounts,
  dayTallies,
  fullDayRun,
  reviewPeriod,
  reviewSummary,
  reviewWindowDates,
  trackerStandings,
  type ReviewRange,
} from '../review';
import { useElementStore } from '../store/elementStore';
import { layout, space } from '../theme/spacing';
import { getActiveElements } from '../utils/dashboardElements';
import { formatAxisLabel } from '../utils/dates';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { playChartSelectHaptic } from '../utils/habitHaptics';
import { timingOrSnap } from '../utils/motion';
import ReviewFacts from './review/ReviewFacts';
import ReviewHeatMap, { HEAT_MAP_PADDING } from './review/ReviewHeatMap';
import ReviewStandings from './review/ReviewStandings';
import ReviewStatement from './review/ReviewStatement';
import { reviewStatement } from './review/reviewCopy';
import { REVIEW_MAX_WIDTH } from './review/reviewGeometry';
import { standingRows } from './review/reviewRows';
import { REVIEW_LOAD_DAYS, useReviewData } from './review/useReviewData';
import { HomeTabScrollView } from './shared/HomeTabScrollView';
import { homeTabScreenStyles } from './shared/screenStyles';

const RANGES: readonly ReviewRange[] = ['week', 'month', 'year'];
const RANGE_FADE_MS = 160;

/** The range last picked, kept for the session only — a fresh start opens on Month. */
let sessionRange: ReviewRange = 'month';

type Props = {
  /** Whether Review is the screen in front. It reads nothing while it is not. */
  active: boolean;
};

/**
 * Review: how the plan went. A sentence, three figures, one square a day
 * shaded by how much of that day was done, then the trackers that are holding
 * and the ones that are slipping. Pushed from Today's progress line and from
 * More, under the stack header. It loads two years once and cuts each range
 * from that in memory, so switching range is instant.
 */
function ReviewScreen({ active }: Props) {
  const { t } = useTranslation(['review', 'common']);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const storeLoaded = useElementStore((s) => s.isLoaded);
  const [range, setRange] = useState<ReviewRange>(sessionRange);
  const fade = useRef(new Animated.Value(1)).current;

  const trackers = useMemo(() => getActiveElements(elements, dashboard), [elements, dashboard]);
  const calendarToday = currentAppCalendarDate(useAppCalendarNow());
  const { data, failed, retry } = useReviewData(active, trackers, calendarToday);
  // Everything is drawn as of the day the data was read on, so a square and
  // its figures never disagree across midnight.
  const today = data?.today ?? calendarToday;

  /** What was loaded, less any tracker archived since, each with its name. */
  const loaded = useMemo(() => {
    const nameOf = new Map(trackers.map((element) => [element.id, element.name]));
    return (data?.trackers ?? []).flatMap((item) => {
      const name = nameOf.get(item.tracker.id);
      return name === undefined ? [] : [{ ...item, name }];
    });
  }, [data, trackers]);

  /** The run reaches back past any range, so it is counted once per load. */
  const run = useMemo(
    () => fullDayRun(dayTallies(loaded, reviewWindowDates(today, REVIEW_LOAD_DAYS), today), today),
    [loaded, today],
  );

  const period = useMemo(() => reviewPeriod(range, today), [range, today]);
  const days = useMemo(() => dayTallies(loaded, period.days, today), [loaded, period, today]);

  const view = useMemo(() => {
    if (!data) return null;
    const byId = new Map(loaded.map((item) => [item.tracker.id, item]));
    const best = bestWeekday(days);
    return {
      statement: reviewStatement(reviewSummary({ trackers: loaded, period, today }), range),
      facts: {
        fullDays: dayCounts(days).full,
        run,
        bestDay:
          best === null ? null : formatAxisLabel(shiftDateString(weekStartDateString(today), best), 'weekday'),
      },
      lists: standingRows(trackerStandings(loaded, period.days, today), (id) => byId.get(id)),
    };
  }, [data, loaded, days, period, range, today, run]);

  const heatLabel = useMemo(() => {
    const title =
      range === 'month'
        ? parseLocalDate(today).toLocaleDateString(getDateLocale(), { month: 'long' })
        : t(`heat.title.${range}`);
    return t('heat.a11y', { title, ...dayCounts(days) });
  }, [days, range, today, t]);

  const changeRange = useCallback(
    (next: ReviewRange) => {
      sessionRange = next;
      // Ornament: under reduced motion the new range simply appears.
      if (!reduceMotion) fade.setValue(0);
      setRange(next);
      void playChartSelectHaptic();
      timingOrSnap(fade, { toValue: 1, duration: RANGE_FADE_MS, useNativeDriver: true }, reduceMotion).start();
    },
    [fade, reduceMotion],
  );

  const openTracker = useCallback(
    (elementId: string) => navigation.navigate('TrackerHistory', { elementId }),
    [navigation],
  );

  const contentWidth = Math.min(windowWidth - layout.gutter * 2, REVIEW_MAX_WIDTH);

  let body: React.ReactNode = null;
  if (trackers.length === 0) {
    body = storeLoaded ? <EmptyState message={t('empty')} /> : null;
  } else if (failed && !data) {
    body = (
      <EmptyState
        message={t('couldNotLoad')}
        actionLabel={t('common:actions.retry')}
        onAction={retry}
      />
    );
  } else {
    body = (
      <>
        <SegmentedControl
          options={RANGES.map((value) => ({ value, label: t(`range.${value}`) }))}
          value={range}
          onChange={changeRange}
        />
        <Animated.View style={[styles.range, { opacity: fade }]}>
          <ReviewStatement statement={view?.statement ?? null} />
          <ReviewFacts facts={view?.facts ?? null} />
          <ReviewHeatMap
            range={range}
            days={days}
            today={today}
            estimatedWidth={contentWidth - HEAT_MAP_PADDING * 2}
            accessibilityLabel={heatLabel}
          />
          <ReviewStandings
            title={t('sections.holding')}
            rows={view?.lists.holding ?? []}
            onOpenTracker={openTracker}
          />
          <ReviewStandings
            title={t('sections.slipping')}
            rows={view?.lists.slipping ?? []}
            onOpenTracker={openTracker}
          />
        </Animated.View>
      </>
    );
  }

  return (
    <HomeTabScrollView contentContainerStyle={homeTabScreenStyles.container}>
      <View style={styles.stack}>{body}</View>
    </HomeTabScrollView>
  );
}

const styles = StyleSheet.create({
  /** The scroll view wraps its children in one box, so the gap lives here. */
  stack: {
    width: '100%',
    maxWidth: REVIEW_MAX_WIDTH,
    alignSelf: 'center',
    gap: space.xl,
  },
  /** Everything a range changes, cross-fading as one. */
  range: {
    gap: space.lg,
  },
});

export default memo(ReviewScreen);
