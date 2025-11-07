/**
 * CookingPanel Component
 * Placeholder for cooking/recipe features
 * Future: Recipe display, ingredient scaling, instructions
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface CookingPanelProps {
  activityId: string;
}

export default function CookingPanel({ activityId }: CookingPanelProps) {
  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={styles.title}>
        Recipe Options
      </Text>

      <View style={styles.section}>
        <Text variant="bodySmall" style={styles.placeholder}>
          Coming soon:
        </Text>
        <Text variant="bodySmall" style={styles.featureList}>
          • Select from your recipes{'\n'}
          • View ingredients and instructions{'\n'}
          • Scale servings automatically
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
