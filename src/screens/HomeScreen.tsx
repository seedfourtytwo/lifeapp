import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WeatherBubble from '../components/WeatherBubble';
import { useAppTheme } from '../hooks/useAppTheme';
import { useDayRolloverRefresh } from '../hooks/useDayRolloverRefresh';
import type { RootStackParamList } from '../navigation/types';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import CountersScreen from './CountersScreen';
import DailyScreen from './DailyScreen';

type HomeTab = 'daily' | 'counters';

type DockIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: { value: HomeTab; label: string; icon: DockIconName }[] = [
  { value: 'daily', label: 'Daily', icon: 'calendar-check' },
  { value: 'counters', label: 'Counter', icon: 'counter' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<HomeTab>('daily');
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const refreshWeather = useWeatherStore((s) => s.refresh);

  useDayRolloverRefresh();

  useEffect(() => {
    if (!weatherWidgetEnabled) return;
    void refreshWeather({ force: false });
  }, [weatherWidgetEnabled, refreshWeather]);

  const activeColor = isCartoon
    ? theme.colors.onSecondaryContainer
    : theme.colors.primary;
  const quietColor = theme.colors.onSurfaceVariant;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {tab === 'daily' ? <DailyScreen /> : <CountersScreen />}
      </View>

      {weatherWidgetEnabled ? <WeatherBubble /> : null}

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
        {TABS.map(({ value, label, icon }) => {
          const active = tab === value;
          const color = active ? activeColor : quietColor;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              style={styles.dockItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <MaterialCommunityIcons name={icon} size={22} color={color} />
              <Text
                variant="labelSmall"
                style={{
                  color,
                  fontWeight: active ? '700' : '500',
                  marginTop: 2,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => navigation.navigate('SettingsMenu')}
          style={styles.dockItem}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color={quietColor} />
          <Text
            variant="labelSmall"
            style={{
              color: quietColor,
              fontWeight: '500',
              marginTop: 2,
            }}
          >
            Settings
          </Text>
        </Pressable>
      </View>
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
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  dockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 48,
  },
});
