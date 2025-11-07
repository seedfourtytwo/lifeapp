/**
 * WorkoutPanel Component
 * Placeholder for workout-specific features
 * Future: Exercise routines, reps tracking, rest timers
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface WorkoutPanelProps {
  activityId: string;
}

export default function WorkoutPanel({ activityId: _activityId }: WorkoutPanelProps) {
  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={styles.title}>
        Workout Options
      </Text>

      <View style={styles.section}>
        <Text variant="bodySmall" style={styles.placeholder}>
          Coming soon:
        </Text>
        <Text variant="bodySmall" style={styles.featureList}>
          • Exercise routines{'\n'}
          • Reps and sets tracking{'\n'}
          • Rest period timers
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontWeight: '600',
  },
  section: {
    gap: 8,
  },
  placeholder: {
    color: '#666',
  },
  featureList: {
    color: '#999',
    lineHeight: 20,
  },
});
