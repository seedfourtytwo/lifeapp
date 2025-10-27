/**
 * ProgressRing Component
 * Displays a circular progress indicator with percentage
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressRingProps {
  percentage: number; // 0-100
  size?: number;
  status: 'excellent' | 'good' | 'poor';
}

const STATUS_COLORS = {
  excellent: '#4CAF50', // Green
  good: '#FF9800', // Orange
  poor: '#F44336', // Red
};

export default function ProgressRing({ percentage, size = 60, status }: ProgressRingProps) {
  const color = STATUS_COLORS[status];
  const displayPercentage = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            borderWidth: size / 10,
          },
        ]}
      >
        <Text style={[styles.percentage, { fontSize: size / 3 }]}>{displayPercentage}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  percentage: {
    fontWeight: 'bold',
    color: '#000',
  },
});
