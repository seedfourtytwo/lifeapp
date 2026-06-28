import React, { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { CounterConfigSchema } from '../protocol';
import { getKindHandler } from '../kinds/registry';
import { useElementStore } from '../store/elementStore';
import { useEventStore } from '../store/eventStore';

export default function DashboardScreen() {
  const { dashboard, elements, isLoading, error, load } = useElementStore();
  const { dailyTotals, loadDailyTotals, logEvent } = useEventStore();

  const refresh = useCallback(async () => {
    await load();
    const elementIds = dashboard.map((d) => d.elementId);
    if (elementIds.length > 0) {
      await loadDailyTotals(elementIds);
    }
  }, [load, dashboard, loadDailyTotals]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (isLoading && elements.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const elementMap = new Map(elements.map((e) => [e.id, e]));

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {dashboard.length === 0 ? (
        <Text variant="bodyLarge" style={styles.empty}>
          No widgets on your dashboard. Add elements from the Elements tab.
        </Text>
      ) : (
        dashboard.map((item) => {
          const element = elementMap.get(item.elementId);
          if (!element) return null;

          const handler = getKindHandler(element.kind);
          if (!handler) return null;

          const Widget = handler.DashboardWidget;
          const config = element.kind === 'counter'
            ? CounterConfigSchema.parse(element.config)
            : element.config;

          return (
            <Widget
              key={item.id}
              element={element}
              config={config}
              todayTotal={dailyTotals[element.id] ?? 0}
              onLog={(value, meta) => logEvent(element.id, value, meta)}
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
  },
  error: {
    color: '#B00020',
    marginBottom: 12,
  },
});
