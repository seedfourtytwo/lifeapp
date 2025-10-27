/**
 * DayCard Component
 * Displays a single day's achievement in the week view
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import ProgressRing from './ProgressRing';

interface DayCardProps {
  date: Date;
  score: number;
  status: 'excellent' | 'good' | 'poor';
  isSelected: boolean;
  onPress: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DayCard({ date, score, status, isSelected, onPress }: DayCardProps) {
  const dayName = DAYS[date.getDay()];
  const dayNumber = date.getDate();

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.selectedContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text variant="labelMedium" style={styles.dayName}>
        {dayName}
      </Text>
      <Text variant="labelSmall" style={styles.dayNumber}>
        {dayNumber}
      </Text>
      <View style={styles.ringContainer}>
        <ProgressRing percentage={score} size={50} status={status} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedContainer: {
    backgroundColor: '#E8F5E9',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  dayName: {
    fontWeight: '600',
    color: '#666',
  },
  dayNumber: {
    color: '#999',
    marginBottom: 8,
  },
  ringContainer: {
    marginTop: 4,
  },
});
