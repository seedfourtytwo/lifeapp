import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import { useChromeBubbleDrag } from '../hooks/useChromeBubbleDrag';
import { toDateString } from '../protocol';
import { useCalendarStore } from '../store/calendarStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import {
  BUBBLE_HEIGHT,
  BUBBLE_WIDTH,
  CAL_CHIP_SIZE,
  CAL_ONLY_HEIGHT,
  CAL_ONLY_WIDTH,
  DOCK_RESERVE,
  EXPAND_DAY_COUNT,
  STRIP_GAP,
  STRIP_HEIGHT,
  forecastStripWidth,
} from '../weather/bubblePosition';
import { conditionLabel } from '../weather/codes';
import { formatTempC } from '../weather/format';
import { ATTENTION_WITHIN_DAYS } from '../calendar/attention';
import CalendarPeekSheet from './CalendarPeekSheet';
import CornerConfettiBurst, {
  type CornerConfettiHandle,
} from './weather/CornerConfettiBurst';
import WeatherDayFace from './weather/WeatherDayFace';
import WeatherForecastStrip from './weather/WeatherForecastStrip';

export default function HomeChromeBubble() {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const { decorations: deco, isCartoon } = useAppTheme();
  const accent = isCartoon ? theme.colors.secondary : theme.colors.primary;
  const outlineColor = isCartoon ? theme.colors.outline : theme.colors.outlineVariant;
  const outlineWidth = isCartoon ? deco.borderWidth : StyleSheet.hairlineWidth;
  const insets = useSafeAreaInsets();
  const weatherEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const calendarEnabled = useSettingsStore((s) => s.calendarWidgetEnabled);
  const savedX = useSettingsStore((s) => s.weatherBubbleX);
  const savedY = useSettingsStore((s) => s.weatherBubbleY);
  const setBubblePosition = useSettingsStore((s) => s.setWeatherBubblePosition);

  const forecast = useWeatherStore((s) => s.forecast);
  const weatherError = useWeatherStore((s) => s.error);
  const weatherOffline = useWeatherStore((s) => s.offline);
  const weatherLoading = useWeatherStore((s) => s.loading);

  const confettiRef = useRef<CornerConfettiHandle>(null);

  const [badgeNow, setBadgeNow] = useState(() => Date.now());
  useEffect(() => {
    if (!calendarEnabled) return;
    const timer = setInterval(() => setBadgeNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [calendarEnabled]);

  const events = useCalendarStore((s) => s.events);
  const calendars = useCalendarStore((s) => s.calendars);
  const clearedByKey = useCalendarStore((s) => s.clearedByKey);
  const badgeCount = useMemo(() => {
    if (!calendarEnabled || events.length === 0) return 0;
    void badgeNow;
    void calendars;
    void clearedByKey;
    return useCalendarStore.getState().attentionOccurrences(50, ATTENTION_WITHIN_DAYS).length;
  }, [calendarEnabled, events, calendars, clearedByKey, badgeNow]);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarChipVisible, setCalendarChipVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [expanded, expandAnim]);

  const tRef = useRef(t);
  tRef.current = t;
  const weatherEnabledRef = useRef(weatherEnabled);
  const calendarEnabledRef = useRef(calendarEnabled);
  weatherEnabledRef.current = weatherEnabled;
  calendarEnabledRef.current = calendarEnabled;

  const toggleExpanded = () => {
    setCalendarChipVisible(false);
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
    allowFling: weatherEnabled,
    chipWidth: weatherEnabled ? BUBBLE_WIDTH : CAL_ONLY_WIDTH,
    chipHeight: weatherEnabled ? BUBBLE_HEIGHT : CAL_ONLY_HEIGHT,
    onTap: () => {
      if (weatherEnabledRef.current) toggleExpanded();
      else if (calendarEnabledRef.current) setCalendarOpen(true);
    },
    onLongPress: () => {
      if (!calendarEnabledRef.current || !weatherEnabledRef.current) return;
      setExpanded(false);
      setCalendarChipVisible(true);
      AccessibilityInfo.announceForAccessibility(tRef.current('chromeBubble.showCalendar'));
    },
    onDragStart: () => {
      setExpanded(false);
      setCalendarChipVisible(false);
    },
    onCornerHit: (x, y) => {
      confettiRef.current?.play(x, y);
    },
  });

  const anyEnabled = weatherEnabled || calendarEnabled;

  const todayIso = toDateString(new Date());
  const otherDays = useMemo(() => {
    if (!forecast?.daily.length) return [];
    return forecast.daily.filter((d) => d.date !== todayIso).slice(0, EXPAND_DAY_COUNT);
  }, [forecast, todayIso]);

  if (!anyEnabled) return null;

  const expandLeft = bubbleLeft + BUBBLE_WIDTH / 2 > layout.width / 2;
  const stripWidth = forecastStripWidth(otherDays.length || EXPAND_DAY_COUNT);
  const stripLeft = expandLeft
    ? bubbleLeft - stripWidth - STRIP_GAP
    : bubbleLeft + BUBBLE_WIDTH + STRIP_GAP;
  const stripTop = bubbleTop + (BUBBLE_HEIGHT - STRIP_HEIGHT) / 2;
  const calChipTop = bubbleTop + BUBBLE_HEIGHT + 6;
  const calChipLeft = bubbleLeft + (BUBBLE_WIDTH - CAL_CHIP_SIZE) / 2;
  const dismissOverlay = expanded || calendarChipVisible;

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

  const a11yParts: string[] = [];
  if (weatherEnabled) {
    a11yParts.push(
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
    );
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
    if (calendarEnabled) a11yParts.push(t('chromeBubble.longPressForCalendar'));
  } else {
    a11yParts.push(t('chromeBubble.todayDate', { date: todayIso }));
    if (badgeCount > 0) a11yParts.push(t('chromeBubble.upcomingCount', { count: badgeCount }));
    a11yParts.push(t('chromeBubble.opensCalendar'));
  }

  const stripOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const stripTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [expandLeft ? 12 : -12, 0],
  });

  const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        onLayout(width, height);
      }}
    >
      {dismissOverlay ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            setExpanded(false);
            setCalendarChipVisible(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('chromeBubble.tapToCollapseForecast')}
        />
      ) : null}

      {weatherEnabled ? <CornerConfettiBurst ref={confettiRef} /> : null}

      {weatherEnabled && expanded && otherDays.length > 0 ? (
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

      {weatherEnabled ? (
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
            ...(calendarEnabled
              ? [{ name: 'longpress' as const, label: t('chromeBubble.longPressForCalendar') }]
              : []),
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate') toggleExpanded();
            if (event.nativeEvent.actionName === 'longpress') {
              setExpanded(false);
              setCalendarChipVisible(true);
            }
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
          />
        </Animated.View>
      ) : (
        <Animated.View
          {...panHandlers}
          style={[
            styles.calendarOnlyBubble,
            {
              backgroundColor: theme.colors.surface,
              borderColor: outlineColor,
              borderWidth: outlineWidth,
              shadowColor: '#000',
              transform: [{ translateX: leftAnim }, { translateY: topAnim }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={a11yParts.join('. ')}
        >
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
            {String(new Date().getDate())}
          </Text>
          <MaterialCommunityIcons name="calendar" size={18} color={accent} />
          {badgeCount > 0 ? (
            <CountBadge
              label={badgeLabel}
              backgroundColor={theme.colors.error}
              color={theme.colors.onError}
            />
          ) : null}
        </Animated.View>
      )}

      {calendarEnabled && weatherEnabled && calendarChipVisible ? (
        <Pressable
          onPress={() => {
            setCalendarChipVisible(false);
            setCalendarOpen(true);
          }}
          style={[
            styles.calChip,
            {
              left: calChipLeft,
              top: calChipTop,
              backgroundColor: theme.colors.surface,
              borderColor: outlineColor,
              borderWidth: outlineWidth,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            badgeCount > 0
              ? t('chromeBubble.openCalendarWithCount', { count: badgeCount })
              : t('chromeBubble.openCalendar')
          }
        >
          <MaterialCommunityIcons name="calendar" size={22} color={accent} />
          {badgeCount > 0 ? (
            <CountBadge
              label={badgeLabel}
              backgroundColor={theme.colors.error}
              color={theme.colors.onError}
              style={styles.fanBadge}
            />
          ) : null}
        </Pressable>
      ) : null}

      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setCalendarOpen(false)}>
          <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
            <CalendarPeekSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CountBadge({
  label,
  backgroundColor,
  color,
  style,
}: {
  label: string;
  backgroundColor: string;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      <Text variant="labelSmall" style={{ color, fontSize: 10 }}>
        {label}
      </Text>
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
  calendarOnlyBubble: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CAL_ONLY_WIDTH,
    height: CAL_ONLY_HEIGHT,
    borderRadius: CAL_ONLY_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 20,
    paddingVertical: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  fanBadge: {
    top: -2,
    right: -2,
  },
  calChip: {
    position: 'absolute',
    zIndex: 21,
    width: CAL_CHIP_SIZE,
    height: CAL_CHIP_SIZE,
    borderRadius: CAL_CHIP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  expandStrip: {
    position: 'absolute',
    zIndex: 19,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
  },
});
