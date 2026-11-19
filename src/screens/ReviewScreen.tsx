import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EmptyState from '../components/EmptyState';
import SegmentedControl from '../components/SegmentedControl';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useReduceMotion } from '../hooks/useReduceMotion';
import type { RootStackParamList } from '../navigation/types';
import { reviewSummary, type ReviewRange } from '../review';
import { useElementStore } from '../store/elementStore';
import { layout, space } from '../theme/spacing';
import { getActiveElements } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { playChartSelectHaptic } from '../utils/habitHaptics';
import { timingOrSnap } from '../utils/motion';
import { dayRulesSchedule } from '../utils/trackerDayRules';
import ReviewLedger from './review/ReviewLedger';
import ReviewLegend from './review/ReviewLegend';
import ReviewStatement from './review/ReviewStatement';
import { reviewFootnote, reviewStatement, type SlippedTracker } from './review/reviewCopy';
import {
  REVIEW_MAX_CONTENT_WIDTH,
  REVIEW_MAX_MEASURE,
  strengthColumnWidth,
} from './review/reviewGeometry';
import { reviewRow, trackerScore, type ReviewRow } from './review/reviewRows';
import { useReviewData } from './review/useReviewData';
import { HomeTabScrollView } from './shared/HomeTabScrollView';
import PageHeader from './shared/PageHeader';
import { homeTabScreenStyles } from './shared/screenStyles';

const RANGES: readonly ReviewRange[] = ['week', 'month', 'year'];
const RANGE_FADE_MS = 160;

/** The range last picked, kept for the session only — a fresh start opens on Month. */
let sessionRange: ReviewRange = 'month';

type Props = {
  /** Whether Review is the page on screen. It reads nothing while it is not. */
  active: boolean;
};

/**
 * The Review page of the Home pager: how the plan went, in a sentence, then
 * every tracker on one grid. It loads two years once and cuts each range from
 * that in memory, so switching range is instant.
 */
function ReviewScreen({ active }: Props) {
  const { t } = useTranslation(['review', 'home', 'common']);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const storeLoaded = useElementStore((s) => s.isLoaded);
  const [range, setRange] = useState<ReviewRange>(sessionRange);
  const fade = useRef(new Animated.Value(1)).current;

  const trackers = useMemo(() => getActiveElements(elements, dashboard), [elements, dashboard]);
  const today = currentAppCalendarDate(useAppCalendarNow());
  const { data, failed, retry } = useReviewData(active, trackers, today);

  const scores = useMemo(
    () => new Map((data?.trackers ?? []).map((item) => [item.tracker.id, trackerScore(item, data?.today ?? today)])),
    [data, today],
  );

  const view = useMemo(() => {
    if (!data) return null;
    const nameOf = new Map(trackers.map((element) => [element.id, element.name]));
    // A tracker archived since the load is dropped rather than counted.
    const loaded = data.trackers.filter((item) => nameOf.has(item.tracker.id));
    const summary = reviewSummary({ trackers: loaded, range, today: data.today });
    const rows = new Map<string, ReviewRow>();
    const slippable = new Map<string, SlippedTracker>();
    for (const item of loaded) {
      const { id, rules } = item.tracker;
      const name = nameOf.get(id) ?? '';
      rows.set(
        id,
        reviewRow({ data: item, name, totals: data.totals.get(id) }, range, data.today, scores.get(id) ?? null),
      );
      slippable.set(id, {
        name,
        unit: dayRulesSchedule(rules).type === 'times_per_week' ? 'sessions' : 'days',
      });
    }
    return {
      rows,
      statement: reviewStatement(summary, range),
      footnote: reviewFootnote(summary, (id) => slippable.get(id)),
    };
  }, [data, trackers, range, scores]);

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

  const contentWidth = Math.min(windowWidth - layout.gutter * 2, REVIEW_MAX_CONTENT_WIDTH);
  const header = <PageHeader title={t('home:dock.review')} />;

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
          style={styles.range}
        />
        <ReviewStatement
          statement={view?.statement ?? null}
          footnote={view?.footnote ?? []}
          fade={fade}
        />
        <View style={styles.grid}>
          <ReviewLedger
            trackers={trackers}
            rows={view?.rows ?? EMPTY_ROWS}
            range={range}
            today={data?.today ?? today}
            estimatedWidth={contentWidth - space.lg * 2}
            strengthWidth={strengthColumnWidth(windowWidth)}
            fade={fade}
            onOpenTracker={openTracker}
          />
          {/* A year is drawn as bars, which carry no missed or skipped marks. */}
          {range === 'year' ? null : <ReviewLegend />}
        </View>
      </>
    );
  }

  return (
    <HomeTabScrollView contentContainerStyle={homeTabScreenStyles.container}>
      <View style={styles.stack}>
        {header}
        {body}
      </View>
    </HomeTabScrollView>
  );
}

const EMPTY_ROWS: ReadonlyMap<string, ReviewRow> = new Map();

const styles = StyleSheet.create({
  /** The scroll view wraps its children in one box, so the gap lives here. */
  stack: {
    width: '100%',
    maxWidth: REVIEW_MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: space.xl,
  },
  range: {
    width: '100%',
    maxWidth: REVIEW_MAX_MEASURE,
  },
  grid: {
    gap: space.md,
  },
});

export default memo(ReviewScreen);
