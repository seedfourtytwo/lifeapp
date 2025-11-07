/**
 * ActivityDetailsPanel Component
 * Expandable content panel below running activity
 * Renders type-specific content based on activity type
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Activity } from '../types';

interface ActivityDetailsPanelProps {
  activity: Activity;
  isExpanded: boolean;
}

function ActivityDetailsPanel({ activity, isExpanded }: ActivityDetailsPanelProps) {
  if (!isExpanded) {
    return null;
  }

  // Render type-specific content based on activity type
  const renderContent = () => {
    const activityType = activity.activityType || 'standard';

    switch (activityType) {
      case 'meditation':
        return (
          <View style={styles.contentSection}>
            <Text variant="bodyMedium" style={styles.placeholder}>
              Meditation features coming soon
            </Text>
            <Text variant="bodySmall" style={styles.placeholderSubtext}>
              Timer presets, music selection, guided meditation
            </Text>
          </View>
        );

      case 'cooking':
        return (
          <View style={styles.contentSection}>
            <Text variant="bodyMedium" style={styles.placeholder}>
              Recipe features coming soon
            </Text>
            <Text variant="bodySmall" style={styles.placeholderSubtext}>
              Recipe display, ingredient scaling
            </Text>
          </View>
        );

      case 'workout':
        return (
          <View style={styles.contentSection}>
            <Text variant="bodyMedium" style={styles.placeholder}>
              Workout features coming soon
            </Text>
            <Text variant="bodySmall" style={styles.placeholderSubtext}>
              Exercise routines, reps tracking
            </Text>
          </View>
        );

      case 'standard':
      default:
        return (
          <View style={styles.contentSection}>
            <Text variant="bodySmall" style={styles.placeholderSubtext}>
              No additional features for this activity
            </Text>
          </View>
        );
    }
  };

  return <View style={styles.container}>{renderContent()}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginHorizontal: 8,
    marginTop: -4,
    marginBottom: 4,
    padding: 16,
  },
  contentSection: {
    gap: 8,
  },
  placeholder: {
    textAlign: 'center',
    color: '#666',
  },
  placeholderSubtext: {
    textAlign: 'center',
    color: '#999',
  },
});

export default React.memo(ActivityDetailsPanel);
