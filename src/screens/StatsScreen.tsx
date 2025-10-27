/**
 * StatsScreen
 * Display statistics and insights (placeholder for now)
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export default function StatsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Statistics
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Coming Soon!
        </Text>
        <Text variant="bodyMedium" style={styles.description}>
          This screen will show your daily, weekly, and monthly activity statistics with charts and insights.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    color: '#666',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
});
