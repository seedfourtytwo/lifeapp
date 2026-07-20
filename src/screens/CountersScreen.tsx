import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { CounterConfigSchema, type CounterConfig } from '../protocol';
import {
  refreshAllCounterData,
  useRefreshCounterTotalsOnFocus,
} from '../hooks/useCounterDataRefresh';
import { getKindHandler } from '../kinds/registry';
import type { RootStackParamList } from '../navigation/types';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';
import { getActiveCounters } from '../utils/dashboardElements';
import ReorderControls from './shared/ReorderControls';
import EmptyTabState from './shared/EmptyTabState';
import { homeTabScreenStyles } from './shared/screenStyles';

export default function CountersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dashboard = useElementStore((s) => s.dashboard);
  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const reorderCounter = useElementStore((s) => s.reorderCounter);
  const { dailyTotals, logEvent, setDailyTotal } = useEventStore(
    useShallow((s) => ({
      dailyTotals: s.dailyTotals,
      logEvent: s.logEvent,
      setDailyTotal: s.setDailyTotal,
    })),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);

  useRefreshCounterTotalsOnFocus();

  const counters = useMemo(
    () => getActiveCounters(elements, dashboard),
    [elements, dashboard],
  );

  const counterConfigs = useMemo(() => {
    const configs = new Map<string, CounterConfig>();
    for (const element of counters) {
      configs.set(element.id, CounterConfigSchema.parse(element.config));
    }
    return configs;
  }, [counters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllCounterData();
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (isLoading && elements.length === 0 && !error) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          enabled={!reordering}
        />
      }
    >
      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          <Button mode="outlined" onPress={() => void onRefresh()}>
            Retry
          </Button>
        </View>
      ) : null}

      {counters.length > 0 ? (
        <View style={styles.metaRow}>
          <Text variant="bodyMedium" style={styles.metaStatus} numberOfLines={1}>
            {reordering
              ? 'Move with arrows'
              : 'Today · resets at midnight'}
          </Text>
          {reordering ? (
            <Button compact mode="text" onPress={() => setReordering(false)}>
              Done
            </Button>
          ) : (
            <Button
              mode="text"
              compact
              icon="sort"
              disabled={counters.length < 2}
              onPress={() => setReordering(true)}
            >
              Sort
            </Button>
          )}
        </View>
      ) : null}

      {counters.length === 0 ? (
        <EmptyTabState
          message={
            elements.some((e) => e.kind === 'counter')
              ? 'No active counters. Restore something from Archive in Trackers.'
              : 'No counters yet. Add one to track water, steps, or anything countable. Totals reset each day.'
          }
        />
      ) : (
        counters.map((element, index) => {
          const handler = getKindHandler(element.kind);
          if (!handler) return null;

          const Widget = handler.DashboardWidget;
          const config = counterConfigs.get(element.id);
          if (!config) return null;

          return (
            <View key={element.id} style={styles.reorderRow}>
              {reordering ? (
                <ReorderControls
                  canMoveUp={index > 0}
                  canMoveDown={index < counters.length - 1}
                  onMoveUp={() => void reorderCounter(element.id, 'up')}
                  onMoveDown={() => void reorderCounter(element.id, 'down')}
                  accessibilityNoun="counter"
                />
              ) : null}
              <View style={styles.reorderCard}>
                <Widget
                  element={element}
                  config={config}
                  todayTotal={dailyTotals[element.id] ?? 0}
                  onLog={(value, meta) =>
                    logEvent(element.id, value, meta).catch((err) => {
                      Alert.alert(
                        'Could not log',
                        err instanceof Error ? err.message : 'Something went wrong',
                      );
                    })
                  }
                  onSetDailyTotal={(total) =>
                    setDailyTotal(element.id, total).catch((err) => {
                      Alert.alert(
                        'Could not update total',
                        err instanceof Error ? err.message : 'Something went wrong',
                      );
                    })
                  }
                  onOpenDetails={() =>
                    navigation.navigate('TrackerHistory', { elementId: element.id })
                  }
                />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = homeTabScreenStyles;
