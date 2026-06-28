import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import type { CounterConfig } from '../../protocol';
import type { WidgetProps } from '../types';

export function CounterWidget({
  element,
  config,
  todayTotal,
  onLog,
}: WidgetProps<CounterConfig>) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">{element.name}</Text>
        <Text variant="displaySmall" style={styles.total}>
          {todayTotal} {config.unit}
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Today
        </Text>
        <View style={styles.buttons}>
          {config.quickIncrements.map((increment) => (
            <Button
              key={increment}
              mode="contained"
              onPress={() => void onLog(increment, { source: 'quick_button', increment })}
              style={styles.button}
            >
              +{increment}
            </Button>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  total: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    opacity: 0.6,
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flexGrow: 1,
  },
});
