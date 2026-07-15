import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CounterConfigSchema } from '../protocol';
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
import { homeTabScreenStyles } from './shared/screenStyles';

export default function CountersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dashboard = useElementStore((s) => s.dashboard);
  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const reorderCounter = useElementStore((s) => s.reorderCounter);
  const { dailyTotals, logEvent, setDailyTotal } = useEventStore();
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);

  useRefreshCounterTotalsOnFocus();

  const counters = useMemo(
    () => getActiveCounters(elements, dashboard),
    [elements, dashboard],
  );

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
              : `${counters.length} counter${counters.length === 1 ? '' : 's'}`}
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
        <Text variant="bodyLarge" style={styles.empty}>
          {elements.some((e) => e.kind === 'counter')
            ? 'No active counters. Open Settings → Elements to restore something from Archive.'
            : 'No counters yet. Open Settings to add one.'}
        </Text>
      ) : (
        counters.map((element, index) => {
          const handler = getKindHandler(element.kind);
          if (!handler) return null;

          const Widget = handler.DashboardWidget;
          const config = CounterConfigSchema.parse(element.config);

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
                  onLog={(value, meta) => logEvent(element.id, value, meta)}
                  onSetDailyTotal={(total) => setDailyTotal(element.id, total)}
                  onOpenDetails={() =>
                    navigation.navigate('ElementHistory', { elementId: element.id })
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
