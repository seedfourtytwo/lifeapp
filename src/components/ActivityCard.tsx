/**
 * ActivityCard Component
 * Compact activity card for 4x4 grid layout (idle state only)
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Activity } from '../types';

interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
}

function ActivityCard({ activity, onPress }: ActivityCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: activity.color }]}
      onPress={onPress}
      accessible={true}
      accessibilityLabel={`Start ${activity.name} timer`}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Icon name={activity.icon as any} size={28} color="#FFFFFF" />
        <Text variant="bodySmall" style={styles.name} numberOfLines={2}>
          {activity.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    padding: 12,
    margin: 4,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
  },
});

export default React.memo(ActivityCard);
