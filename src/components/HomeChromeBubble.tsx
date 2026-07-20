import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { toDateString } from '../protocol';
import { useCalendarStore } from '../store/calendarStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import {
  BUBBLE_HEIGHT,
  BUBBLE_SIZE,
  clampBubblePosition,
} from '../weather/bubblePosition';
import { conditionIconName, conditionLabel } from '../weather/codes';
import { formatTempC } from '../weather/format';
import CalendarPeekSheet from './CalendarPeekSheet';
import WeatherForecastSheet from './WeatherForecastSheet';

const DOCK_RESERVE = 72;
const TAP_SLOP = 8;
/** Badge looks ahead this many days for “needs attention” count. */
const BADGE_WITHIN_DAYS = 14;

type SheetKind = 'weather' | 'calendar' | null;

export default function HomeChromeBubble() {
  const theme = useTheme();
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

  // Primitive selector — re-runs when calendar store data or local clock tick changes.
  const [badgeNow, setBadgeNow] = useState(() => Date.now());
  useEffect(() => {
    if (!calendarEnabled) return;
    const timer = setInterval(() => setBadgeNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [calendarEnabled]);

  const badgeCount = useCalendarStore((s) => {
    if (!calendarEnabled || s.events.length === 0) return 0;
    void badgeNow;
    return s.attentionOccurrences(50, BADGE_WITHIN_DAYS).length;
  });

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [fanOpen, setFanOpen] = useState(false);
  const [layout, setLayout] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  const [pos, setPos] = useState({ x: savedX, y: savedY });

  useEffect(() => {
    setPos({ x: savedX, y: savedY });
  }, [savedX, savedY]);

  const layoutRef = useRef(layout);
  const insetsRef = useRef(insets);
  const posRef = useRef(pos);
  const dragOrigin = useRef(pos);
  const moved = useRef(false);

  layoutRef.current = layout;
  insetsRef.current = insets;
  posRef.current = pos;

  const bottomInset = insets.bottom + DOCK_RESERVE;
  const clamped = clampBubblePosition(pos.x, pos.y, {
    width: layout.width,
    height: layout.height,
    topInset: insets.top,
    bottomInset,
  });

  const bothEnabled = weatherEnabled && calendarEnabled;
  const anyEnabled = weatherEnabled || calendarEnabled;

  const weatherEnabledRef = useRef(weatherEnabled);
  const calendarEnabledRef = useRef(calendarEnabled);
  const bothEnabledRef = useRef(bothEnabled);
  weatherEnabledRef.current = weatherEnabled;
  calendarEnabledRef.current = calendarEnabled;
  bothEnabledRef.current = bothEnabled;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          dragOrigin.current = posRef.current;
          moved.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          if (Math.abs(gesture.dx) > TAP_SLOP || Math.abs(gesture.dy) > TAP_SLOP) {
            moved.current = true;
            setFanOpen(false);
          }
          const { width, height } = layoutRef.current;
          const topInset = insetsRef.current.top;
          const bottom = insetsRef.current.bottom + DOCK_RESERVE;
          const nextX = dragOrigin.current.x + gesture.dx / Math.max(width, 1);
          const nextY = dragOrigin.current.y + gesture.dy / Math.max(height, 1);
          const next = clampBubblePosition(nextX, nextY, {
            width,
            height,
            topInset,
            bottomInset: bottom,
          });
          setPos(next);
        },
        onPanResponderRelease: () => {
          if (!moved.current) {
            if (bothEnabledRef.current) {
              setFanOpen((open) => !open);
            } else if (weatherEnabledRef.current) {
              setSheet('weather');
            } else if (calendarEnabledRef.current) {
              setSheet('calendar');
            }
            return;
          }
          void setBubblePosition(posRef.current.x, posRef.current.y);
        },
      }),
    [setBubblePosition],
  );

  if (!anyEnabled) return null;

  const today = new Date();
  const dayNum = String(today.getDate());
  const hasForecast = forecast != null;
  const condition = forecast?.currentCondition ?? 'other';
  const tempLabel = hasForecast ? formatTempC(forecast.currentTempC) : '—';

  const weatherIcon =
    !hasForecast && weatherOffline
      ? 'cloud-off-outline'
      : !hasForecast && weatherError
        ? 'weather-cloudy-alert'
        : conditionIconName(condition);

  const a11yParts: string[] = [];
  if (calendarEnabled) {
    a11yParts.push(`Today ${toDateString(today)}`);
    if (badgeCount > 0) a11yParts.push(`${badgeCount} upcoming`);
  }
  if (weatherEnabled) {
    a11yParts.push(
      hasForecast
        ? `Weather ${tempLabel}, ${conditionLabel(condition)}`
        : (weatherError ?? (weatherOffline ? 'Weather offline' : weatherLoading ? 'Loading weather' : 'Weather unavailable')),
    );
  }
  a11yParts.push(bothEnabled ? 'Opens weather or calendar' : weatherEnabled ? 'Opens forecast' : 'Opens calendar');

  const bubbleLeft = clamped.x * layout.width;
  const bubbleTop = clamped.y * layout.height;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
      }}
    >
      {fanOpen ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setFanOpen(false)} />
      ) : null}

      {fanOpen && weatherEnabled ? (
        <Pressable
          onPress={() => {
            setFanOpen(false);
            setSheet('weather');
          }}
          style={[
            styles.fanChip,
            {
              left: bubbleLeft + (BUBBLE_SIZE - 40) / 2,
              top: bubbleTop + BUBBLE_HEIGHT + 6,
              backgroundColor: theme.colors.surface,
              borderColor: outlineColor,
              borderWidth: outlineWidth,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open weather"
        >
          <MaterialCommunityIcons name="weather-partly-cloudy" size={22} color={accent} />
        </Pressable>
      ) : null}

      {fanOpen && calendarEnabled ? (
        <Pressable
          onPress={() => {
            setFanOpen(false);
            setSheet('calendar');
          }}
          style={[
            styles.fanChip,
            {
              left: bubbleLeft + (BUBBLE_SIZE - 40) / 2,
              top: bubbleTop + BUBBLE_HEIGHT + (weatherEnabled ? 52 : 6),
              backgroundColor: theme.colors.surface,
              borderColor: outlineColor,
              borderWidth: outlineWidth,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            badgeCount > 0
              ? `Open calendar, ${badgeCount} upcoming`
              : 'Open calendar'
          }
        >
          <MaterialCommunityIcons name="calendar" size={22} color={accent} />
          {badgeCount > 0 ? (
            <View style={[styles.fanBadge, { backgroundColor: theme.colors.error }]}>
              <Text variant="labelSmall" style={{ color: theme.colors.onError, fontSize: 10 }}>
                {badgeCount > 9 ? '9+' : badgeCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <View
        {...panResponder.panHandlers}
        style={[
          styles.bubble,
          {
            left: bubbleLeft,
            top: bubbleTop,
            backgroundColor: theme.colors.surface,
            borderColor: outlineColor,
            borderWidth: outlineWidth,
            shadowColor: '#000',
            opacity: weatherOffline && hasForecast ? 0.92 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11yParts.join('. ')}
      >
        {calendarEnabled ? (
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
            {dayNum}
          </Text>
        ) : null}
        {weatherEnabled ? (
          <>
            <MaterialCommunityIcons
              name={weatherIcon}
              size={calendarEnabled ? 16 : 20}
              color={
                !hasForecast && (weatherOffline || weatherError)
                  ? theme.colors.onSurfaceVariant
                  : accent
              }
            />
            {!calendarEnabled ? (
              <Text variant="labelLarge" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                {tempLabel}
              </Text>
            ) : (
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: -2 }}
                numberOfLines={1}
              >
                {tempLabel}
              </Text>
            )}
          </>
        ) : (
          <MaterialCommunityIcons name="calendar" size={18} color={accent} />
        )}
        {calendarEnabled && badgeCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
            <Text variant="labelSmall" style={{ color: theme.colors.onError, fontSize: 10 }}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={sheet != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSheet(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {sheet === 'weather' ? (
              <WeatherForecastSheet onClose={() => setSheet(null)} />
            ) : (
              <CalendarPeekSheet visible={sheet === 'calendar'} onClose={() => setSheet(null)} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_HEIGHT,
    borderRadius: BUBBLE_HEIGHT / 2,
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
  fanChip: {
    position: 'absolute',
    zIndex: 21,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  fanBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
});
