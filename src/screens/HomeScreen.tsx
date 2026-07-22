import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeChromeBubble from '../components/HomeChromeBubble';
import { getDatabase } from '../db/client';
import * as dailyJournalRepo from '../db/repositories/dailyJournalRepository';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAppCalendarNow } from '../hooks/useAppCalendarNow';
import { useDayRolloverRefresh } from '../hooks/useDayRolloverRefresh';
import type { RootStackParamList } from '../navigation/types';
import { NoteEditorHost, useNoteEditorSession } from '../notes';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import { currentAppCalendarDate } from '../utils/dayRollover';
import CountersScreen from './CountersScreen';
import HabitsScreen from './HabitsScreen';

type HomeTab = 'habits' | 'counters';

type DockIconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Throttle GPS refresh so foregrounding doesn't spam location. */
const GPS_REFRESH_MIN_MS = 3 * 60 * 60 * 1000;
let lastGpsRefreshAt = 0;

const TABS: { value: HomeTab; label: string; icon: DockIconName }[] = [
  { value: 'habits', label: 'Habits', icon: 'calendar-check' },
  { value: 'counters', label: 'Counters', icon: 'counter' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<HomeTab>('habits');
  const [hasTodayJournal, setHasTodayJournal] = useState(false);
  const now = useAppCalendarNow();
  const weatherWidgetEnabled = useSettingsStore((s) => s.weatherWidgetEnabled);
  const calendarWidgetEnabled = useSettingsStore((s) => s.calendarWidgetEnabled);
  const weatherLocationMode = useSettingsStore((s) => s.weatherLocationMode);
  const refreshWeather = useWeatherStore((s) => s.refresh);

  const noteEditor = useNoteEditorSession({
    onSaved: (date, body, target) => {
      if (target.kind !== 'journal') return;
      if (date !== currentAppCalendarDate(now)) return;
      setHasTodayJournal(body != null && body.length > 0);
    },
  });

  useDayRolloverRefresh();

  const reloadTodayJournal = useCallback(async () => {
    const today = currentAppCalendarDate(now);
    try {
      const db = await getDatabase();
      const journal = await dailyJournalRepo.getJournal(db, today);
      setHasTodayJournal((journal?.body.length ?? 0) > 0);
    } catch {
      // Non-fatal — icon stays empty until next focus.
    }
  }, [now]);

  useFocusEffect(
    useCallback(() => {
      void reloadTodayJournal();
    }, [reloadTodayJournal]),
  );

  useEffect(() => {
    void reloadTodayJournal();
  }, [reloadTodayJournal]);

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

  const showChrome = weatherWidgetEnabled || calendarWidgetEnabled;
  const activeColor = isCartoon
    ? theme.colors.onSecondaryContainer
    : theme.colors.primary;
  const quietColor = theme.colors.onSurfaceVariant;
  // Edge-to-edge Android draws under the status bar. Absolute-fill panes use top:0
  // relative to the parent, so parent padding is ignored — offset `top` instead.
  const topInset =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? (StatusBar.currentHeight ?? 28)
        : 0;

  const openTodayJournal = (opts?: { dictate?: boolean }) => {
    void noteEditor.open(
      { kind: 'journal' },
      currentAppCalendarDate(now),
      opts?.dictate ? { dictate: true } : undefined,
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View
          style={[
            styles.tabPane,
            { top: topInset },
            tab !== 'habits' && styles.tabPaneHidden,
          ]}
          pointerEvents={tab === 'habits' ? 'auto' : 'none'}
          accessibilityElementsHidden={tab !== 'habits'}
          importantForAccessibility={tab === 'habits' ? 'auto' : 'no-hide-descendants'}
        >
          <HabitsScreen
            hasTodayJournal={hasTodayJournal}
            onOpenJournal={() => openTodayJournal({ dictate: true })}
            onEditJournal={() => openTodayJournal()}
            journalOpen={noteEditor.session != null}
            notesActive={tab === 'habits'}
            onBeforeOpenTrackerNote={noteEditor.dismiss}
          />
        </View>
        <View
          style={[
            styles.tabPane,
            { top: topInset },
            tab !== 'counters' && styles.tabPaneHidden,
          ]}
          pointerEvents={tab === 'counters' ? 'auto' : 'none'}
          accessibilityElementsHidden={tab !== 'counters'}
          importantForAccessibility={tab === 'counters' ? 'auto' : 'no-hide-descendants'}
        >
          <CountersScreen
            hasTodayJournal={hasTodayJournal}
            onOpenJournal={() => openTodayJournal({ dictate: true })}
            onEditJournal={() => openTodayJournal()}
            journalOpen={noteEditor.session != null}
            notesActive={tab === 'counters'}
            onBeforeOpenTrackerNote={noteEditor.dismiss}
          />
        </View>
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
          accessibilityLabel="More"
        >
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={quietColor} />
          <Text
            variant="labelSmall"
            style={{
              color: quietColor,
              fontWeight: '500',
              marginTop: 2,
            }}
          >
            More
          </Text>
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
  tabPane: {
    ...StyleSheet.absoluteFillObject,
  },
  tabPaneHidden: {
    opacity: 0,
    zIndex: -1,
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
