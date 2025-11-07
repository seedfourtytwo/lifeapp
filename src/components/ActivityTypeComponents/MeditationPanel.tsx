/**
 * MeditationPanel Component
 * Placeholder for meditation-specific features
 * Future: Timer presets, music selection, guided meditation
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';

interface MeditationPanelProps {
  activityId: string;
}

export default function MeditationPanel({ activityId }: MeditationPanelProps) {
  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={styles.title}>
        Meditation Options
      </Text>

      <View style={styles.section}>
        <Text variant="bodySmall" style={styles.placeholder}>
          Coming soon:
        </Text>
        <Text variant="bodySmall" style={styles.featureList}>
          • Quick duration presets (5, 15, 30 min){'\n'}
          • Ambient sounds and music{'\n'}
          • Guided meditation instructions
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
