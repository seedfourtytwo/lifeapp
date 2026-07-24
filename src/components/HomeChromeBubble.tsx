import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'react-native-paper';
import { useChromeBubbleDrag } from '../hooks/useChromeBubbleDrag';
import { toDateString } from '../protocol';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import BounceEdgeFlash, {
  type BounceEdgeFlashHandle,
} from './weather/BounceEdgeFlash';
import CornerConfettiBurst, {
  type CornerConfettiHandle,
} from './weather/CornerConfettiBurst';
import WeatherDayFace from './weather/WeatherDayFace';
import WeatherForecastStrip from './weather/WeatherForecastStrip';
import { recordCornerHit, getTodayCornerCount } from '../db/repositories/cornerScoreRepository';
import {
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  DOCK_RESERVE,
  EXPAND_DAY_COUNT,
  STRIP_GAP,
  STRIP_HEIGHT,
  forecastStripWidth,
} from '../weather/bubblePosition';
import { conditionLabel } from '../weather/codes';
import { formatTempC } from '../weather/format';

/** How long the `· N` corner tally stays visible after a hit. */
const CORNER_SCORE_FLASH_MS = 1800;

export default function HomeChromeBubble() {
  const { t } = useTranslation('home');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const weatherEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const savedX = useSettingsStore((s) => s.weatherBubbleX);
  const savedY = useSettingsStore((s) => s.weatherBubbleY);
  const setBubblePosition = useSettingsStore((s) => s.setWeatherBubblePosition);

  const forecast = useWeatherStore((s) => s.forecast);
  const weatherError = useWeatherStore((s) => s.error);
  const weatherOffline = useWeatherStore((s) => s.offline);
  const weatherLoading = useWeatherStore((s) => s.loading);

  const confettiRef = useRef<CornerConfettiHandle>(null);
  const bounceFlashRef = useRef<BounceEdgeFlashHandle>(null);
  const [expanded, setExpanded] = useState(false);
  const [cornerScoreFlash, setCornerScoreFlash] = useState<number | null>(null);
  const cornerCountRef = useRef(0);
  const cornerScoreDateRef = useRef(toDateString(new Date()));
  const cornerHitsBeforeHydrate = useRef(0);
  const cornerFlashActiveRef = useRef(false);
  const cornerFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [expanded, expandAnim]);

  useEffect(() => {
    let alive = true;
    void getTodayCornerCount()
      .then((n) => {
        if (!alive) return;
        cornerScoreDateRef.current = toDateString(new Date());
        // Don't clobber optimistic bumps that landed before hydrate.
        if (cornerHitsBeforeHydrate.current === 0) {
          cornerCountRef.current = n;
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (cornerFlashTimer.current) clearTimeout(cornerFlashTimer.current);
    };
  }, []);

  const tRef = useRef(t);
  tRef.current = t;

  const flashCornerScore = (count: number) => {
    cornerFlashActiveRef.current = true;
    setCornerScoreFlash(count);
    if (cornerFlashTimer.current) clearTimeout(cornerFlashTimer.current);
    cornerFlashTimer.current = setTimeout(() => {
      cornerFlashTimer.current = null;
      cornerFlashActiveRef.current = false;
      setCornerScoreFlash(null);
    }, CORNER_SCORE_FLASH_MS);
  };

  const toggleExpanded = () => {
    setExpanded((open) => {
      const next = !open;
      AccessibilityInfo.announceForAccessibility(
        next
          ? tRef.current('chromeBubble.forecastExpanded')
          : tRef.current('chromeBubble.forecastCollapsed'),
      );
      return next;
    });
  };

  const {
    panHandlers,
    leftAnim,
    topAnim,
    chargeProgress,
    layout,
    bubbleLeft,
    bubbleTop,
    onLayout,
  } = useChromeBubbleDrag({
    savedX,
    savedY,
    setBubblePosition,
    topInset: insets.top,
    bottomInset: insets.bottom + DOCK_RESERVE,
    chipWidth: BUBBLE_WIDTH,
    chipHeight: BUBBLE_HEIGHT,
    onTap: toggleExpanded,
    onDragStart: () => setExpanded(false),
    onCornerHit: (x, y) => {
      confettiRef.current?.play(x, y);
      const today = toDateString(new Date());
      if (today !== cornerScoreDateRef.current) {
        cornerScoreDateRef.current = today;
        cornerCountRef.current = 0;
      }
      const optimistic = cornerCountRef.current + 1;
      cornerCountRef.current = optimistic;
      cornerHitsBeforeHydrate.current += 1;
      flashCornerScore(optimistic);
      void recordCornerHit()
        .then((n) => {
          // Queued writes are authoritative for today.
          cornerCountRef.current = n;
          if (cornerFlashActiveRef.current) setCornerScoreFlash(n);
        })
        .catch(() => {
          cornerCountRef.current = Math.max(0, cornerCountRef.current - 1);
        });
    },
    onBounce: ({ edges, scoredCorner, chipX, chipY, bounds }) => {
      bounceFlashRef.current?.play({
        edges,
        scoredCorner,
        chipX,
        chipY,
        chipW: BUBBLE_WIDTH,
        chipH: BUBBLE_HEIGHT,
        bounds,
      });
    },
  });

  const todayIso = toDateString(new Date());
  const otherDays = useMemo(() => {
    if (!forecast?.daily.length) return [];
    return forecast.daily.filter((d) => d.date !== todayIso).slice(0, EXPAND_DAY_COUNT);
  }, [forecast, todayIso]);

  if (!weatherEnabled) return null;

  const expandLeft = bubbleLeft + BUBBLE_WIDTH / 2 > layout.width / 2;
  const stripWidth = forecastStripWidth(otherDays.length || EXPAND_DAY_COUNT);
  const stripLeft = expandLeft
    ? bubbleLeft - stripWidth - STRIP_GAP
    : bubbleLeft + BUBBLE_WIDTH + STRIP_GAP;
  const stripTop = bubbleTop + (BUBBLE_HEIGHT - STRIP_HEIGHT) / 2;

  const hasForecast = forecast != null;
  const condition = forecast?.currentCondition ?? 'other';
  const todayForecast =
    forecast?.daily.find((d) => d.date === todayIso) ?? forecast?.daily[0];
  const tempMinC = todayForecast?.tempMinC ?? null;
  const tempMaxC = todayForecast?.tempMaxC ?? null;
  const precipPct = hasForecast
    ? (todayForecast?.precipProbabilityPct ?? forecast.precipProbabilityPct)
    : null;
  const tempLabel = hasForecast ? formatTempC(forecast.currentTempC) : '—';
  const trend = hasForecast ? forecast.trend : null;

  const a11yParts: string[] = [
    hasForecast
      ? t('chromeBubble.weatherWithCondition', {
          temp: tempLabel,
          condition: conditionLabel(condition),
        })
      : (weatherError ??
          (weatherOffline
            ? t('chromeBubble.weatherOffline')
            : weatherLoading
              ? t('chromeBubble.weatherLoading')
              : t('chromeBubble.weatherUnavailable'))),
  ];
  if (tempMinC != null && tempMaxC != null) {
    a11yParts.push(`${formatTempC(tempMinC)}/${formatTempC(tempMaxC)}`);
  }
  if (precipPct != null) {
    a11yParts.push(t('chromeBubble.rainChance', { pct: precipPct }));
  }
  if (trend === 'improving') a11yParts.push(t('chromeBubble.trendImproving'));
  if (trend === 'worsening') a11yParts.push(t('chromeBubble.trendWorsening'));
  if (hasForecast && trend == null) a11yParts.push(t('chromeBubble.trendSteady'));
  a11yParts.push(
    expanded ? t('chromeBubble.tapToCollapseForecast') : t('chromeBubble.tapToExpandForecast'),
  );

  const stripOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const stripTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [expandLeft ? 12 : -12, 0],
  });

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        onLayout(width, height);
      }}
    >
      {expanded ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel={t('chromeBubble.tapToCollapseForecast')}
        />
      ) : null}

      <CornerConfettiBurst ref={confettiRef} />
      <BounceEdgeFlash ref={bounceFlashRef} color={theme.colors.outline} />

      {expanded && otherDays.length > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.expandStrip,
            {
              left: stripLeft,
              top: stripTop,
              opacity: stripOpacity,
              transform: [{ translateX: stripTranslateX }, { scale: expandAnim }],
            },
          ]}
        >
          <WeatherForecastStrip days={otherDays} />
        </Animated.View>
      ) : null}

      <Animated.View
        {...panHandlers}
        style={[
          styles.bubbleHit,
          {
            width: BUBBLE_WIDTH,
            height: BUBBLE_HEIGHT,
            opacity: weatherOffline && hasForecast ? 0.92 : 1,
            transform: [{ translateX: leftAnim }, { translateY: topAnim }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11yParts.join('. ')}
        accessibilityActions={[
          {
            name: 'activate',
            label: expanded
              ? t('chromeBubble.tapToCollapseForecast')
              : t('chromeBubble.tapToExpandForecast'),
          },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') toggleExpanded();
        }}
      >
        <WeatherDayFace
          condition={condition}
          currentTempC={hasForecast ? forecast.currentTempC : null}
          tempMinC={tempMinC}
          tempMaxC={tempMaxC}
          precipProbabilityPct={precipPct}
          trend={trend}
          muted={!hasForecast && !!(weatherOffline || weatherError)}
          offline={!hasForecast && weatherOffline}
          error={!hasForecast && !!weatherError && !weatherOffline}
          chargeProgress={chargeProgress}
          cornerScoreFlash={cornerScoreFlash}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleHit: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
  },
  expandStrip: {
    position: 'absolute',
    zIndex: 18,
  },
});
