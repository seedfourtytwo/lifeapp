import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CounterConfigSchema, type ElementDefinition } from '../protocol';
import { getKindHandler } from '../kinds/registry';
import type { RootStackParamList } from '../navigation/types';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';

function sortCounters(
  counters: ElementDefinition[],
  dashboardOrder: Map<string, number>,
): ElementDefinition[] {
  return [...counters].sort((a, b) => {
    const aOrder = dashboardOrder.get(a.id);
    const bOrder = dashboardOrder.get(b.id);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}

export default function CountersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dashboard = useElementStore((s) => s.dashboard);
  const elements = useElementStore((s) => s.elements);
  const isLoading = useElementStore((s) => s.isLoading);
  const error = useElementStore((s) => s.error);
  const load = useElementStore((s) => s.load);
  const { dailyTotals, loadDailyTotals, logEvent, undoLastEvent, setDailyTotal } = useEventStore();
  const [refreshing, setRefreshing] = useState(false);

  const counters = useMemo(() => {
    const all = elements.filter((e) => e.kind === 'counter');
    const order = new Map(dashboard.map((d, index) => [d.elementId, index]));
    return sortCounters(all, order);
  }, [elements, dashboard]);

  const refresh = useCallback(async () => {
    await load();
    const counterIds = useElementStore.getState().elements
      .filter((e) => e.kind === 'counter')
      .map((e) => e.id);
    if (counterIds.length > 0) {
      await loadDailyTotals(counterIds);
    }
  }, [load, loadDailyTotals]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

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
          No counters yet. Tap the gear icon to add one.
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
              onUndo={() => undoLastEvent(element.id)}
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

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 48,
    paddingHorizontal: 24,
  },
  errorBox: {
    marginBottom: 16,
    gap: 8,
  },
  error: {
    marginBottom: 8,
  },
});
