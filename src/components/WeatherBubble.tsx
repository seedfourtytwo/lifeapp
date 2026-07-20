import React, { useMemo, useRef, useState, useEffect } from 'react';
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
import { toDateString } from '../protocol';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import {
  BUBBLE_HEIGHT,
  BUBBLE_SIZE,
  clampBubblePosition,
} from '../weather/bubblePosition';
import { conditionIconName, conditionLabel } from '../weather/codes';
import { formatDayLabel, formatTempC } from '../weather/format';

const DOCK_RESERVE = 72;
const TAP_SLOP = 8;

export default function WeatherBubble() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const savedX = useSettingsStore((s) => s.weatherBubbleX);
  const savedY = useSettingsStore((s) => s.weatherBubbleY);
  const setWeatherBubblePosition = useSettingsStore((s) => s.setWeatherBubblePosition);
  const forecast = useWeatherStore((s) => s.forecast);
  const error = useWeatherStore((s) => s.error);
  const offline = useWeatherStore((s) => s.offline);
  const loading = useWeatherStore((s) => s.loading);

  const [sheetOpen, setSheetOpen] = useState(false);
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
            setSheetOpen(true);
            return;
          }
          void setWeatherBubblePosition(posRef.current.x, posRef.current.y);
        },
      }),
    [setWeatherBubblePosition],
  );

  if (!weatherWidgetEnabled) return null;

  const hasForecast = forecast != null;
  const condition = forecast?.currentCondition ?? 'other';
  const tempLabel = hasForecast ? formatTempC(forecast.currentTempC) : '—';
  const statusLabel = !hasForecast
    ? offline
      ? 'Offline'
      : error
        ? 'Unavailable'
        : loading
          ? '…'
          : null
    : `${forecast.precipProbabilityPct}%`;
  const iconName =
    !hasForecast && offline
      ? 'cloud-off-outline'
      : !hasForecast && error
        ? 'weather-cloudy-alert'
        : conditionIconName(condition);
  const iconColor =
    !hasForecast && (offline || error)
      ? theme.colors.onSurfaceVariant
      : theme.colors.primary;
  const todayForecast = forecast?.daily.find((d) => d.date === toDateString(new Date()));

  const a11y = hasForecast
    ? `Weather ${tempLabel}, ${conditionLabel(condition)}, rain ${forecast.precipProbabilityPct}%${offline ? ', offline cache' : ''}. Opens forecast.`
    : (error ?? (offline ? 'No connection' : 'Weather unavailable'));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
      }}
    >
      <View
        {...panResponder.panHandlers}
        style={[
          styles.bubble,
          {
            left: clamped.x * layout.width,
            top: clamped.y * layout.height,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
            shadowColor: '#000',
            opacity: offline && hasForecast ? 0.92 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
        <Text variant="labelLarge" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
          {tempLabel}
        </Text>
        {statusLabel ? (
          <Text
            variant="labelSmall"
            style={{
              color:
                !hasForecast && (offline || error)
                  ? theme.colors.error
                  : theme.colors.onSurfaceVariant,
              marginTop: -2,
            }}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        ) : null}
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="titleMedium" style={{ marginBottom: 4 }}>
              Forecast
            </Text>
            {offline ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.error, marginBottom: 4 }}
              >
                No connection — showing last saved weather
              </Text>
            ) : null}
            {hasForecast ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
              >
                Now {formatTempC(forecast.currentTempC)}
                {todayForecast
                  ? ` · Today ${Math.round(todayForecast.tempMinC)}°–${Math.round(todayForecast.tempMaxC)}°`
                  : ''}
              </Text>
            ) : null}
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
            >
              Next 5 days · °C · rain chance
            </Text>
            {forecast?.daily.length ? (
              forecast.daily.slice(0, 5).map((day) => (
                <View key={day.date} style={styles.dayRow}>
                  <MaterialCommunityIcons
                    name={conditionIconName(day.condition)}
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text variant="bodyMedium" style={styles.dayDate}>
                    {formatDayLabel(day.date)}
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={[styles.dayRain, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {day.precipProbabilityPct}%
                  </Text>
                  <Text variant="bodyMedium" style={styles.dayTemps}>
                    {Math.round(day.tempMinC)}° / {Math.round(day.tempMaxC)}°
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {error ?? 'No forecast yet. Check location in Settings.'}
              </Text>
            )}
            <Pressable
              onPress={() => setSheetOpen(false)}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close forecast"
            >
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                Close
              </Text>
            </Pressable>
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
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 20,
    paddingVertical: 4,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  dayDate: {
    flex: 1,
    fontWeight: '600',
  },
  dayRain: {
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
  dayTemps: {
    fontVariant: ['tabular-nums'],
    minWidth: 72,
    textAlign: 'right',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 4,
  },
});
