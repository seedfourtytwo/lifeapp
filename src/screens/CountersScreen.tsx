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
import { getPinnedElements } from '../utils/dashboardElements';
import { pinnedTabScreenStyles as styles } from './shared/screenStyles';

export default function CountersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dashboard = useElementStore((s) => s.dashboard);
  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const { dailyTotals, logEvent, setDailyTotal } = useEventStore();
  const [refreshing, setRefreshing] = useState(false);

  useRefreshCounterTotalsOnFocus();

  const counters = useMemo(() => {
    const all = elements.filter((e) => e.kind === 'counter');
    return getPinnedElements(all, dashboard);
  }, [elements, dashboard]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          <Button mode="outlined" onPress={() => void onRefresh()}>
            Retry
          </Button>
        </View>
      ) : null}

      {counters.length === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          {elements.some((e) => e.kind === 'counter')
            ? 'No counters pinned. Open Settings and pin counters to show them here.'
            : 'No counters yet. Open Settings to add one.'}
        </Text>
      ) : (
        counters.map((element) => {
          const handler = getKindHandler(element.kind);
          if (!handler) return null;

          const Widget = handler.DashboardWidget;
          const config = CounterConfigSchema.parse(element.config);

          return (
            <Widget
              key={element.id}
              element={element}
              config={config}
              todayTotal={dailyTotals[element.id] ?? 0}
              onLog={(value, meta) => logEvent(element.id, value, meta)}
              onSetDailyTotal={(total) => setDailyTotal(element.id, total)}
              onOpenDetails={() =>
                navigation.navigate('ElementHistory', { elementId: element.id })
              }
            />
          );
        })
      )}
    </ScrollView>
  );
}
