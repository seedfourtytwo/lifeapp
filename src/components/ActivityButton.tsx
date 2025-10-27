/**
 * ActivityButton Component
 * Displays an activity as a tappable button in the grid
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Activity } from '../types';

interface ActivityButtonProps {
  activity: Activity;
  onPress: () => void;
  isActive?: boolean;
}

export default function ActivityButton({ activity, onPress, isActive = false }: ActivityButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: activity.color },
        isActive && styles.activeContainer,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={`${activity.name} activity button`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.content}>
        <Icon name={activity.icon as any} size={32} color="#FFFFFF" />
        <Text style={styles.text} numberOfLines={2}>
          {activity.name}
        </Text>
        {isActive && (
          <View style={styles.activeIndicator}>
            <Icon name="circle" size={12} color="#FFFFFF" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 16,
    margin: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  activeContainer: {
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
});
