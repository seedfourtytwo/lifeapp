import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import CountersScreen from './CountersScreen';
import DailyScreen from './DailyScreen';

type HomeTab = 'daily' | 'counters';

const TABS: { value: HomeTab; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'counters', label: 'Counter' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<HomeTab>('daily');

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView
        edges={['top']}
        style={[
          styles.headerSafe,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.tabs, { backgroundColor: theme.colors.surfaceVariant }]}>
            {TABS.map(({ value, label }) => {
              const active = tab === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setTab(value)}
                  style={[
                    styles.tab,
                    active && [
                      styles.tabActive,
                      { backgroundColor: theme.colors.surface },
                    ],
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    variant="labelLarge"
                    style={{
                      color: active ? theme.colors.primary : theme.colors.onSurfaceVariant,
                      fontWeight: active ? '600' : '500',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <IconButton
            icon="cog-outline"
            size={22}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() => navigation.navigate('SettingsMenu')}
            accessibilityLabel="Settings"
            style={styles.gear}
          />
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {tab === 'daily' ? <DailyScreen /> : <CountersScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafe: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  gear: {
    margin: 0,
  },
  content: {
    flex: 1,
  },
});
