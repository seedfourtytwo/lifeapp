/**
 * ViewModeSwitcher Component
 * Segmented button group for switching between Day/Week/Month views
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { ViewMode } from '../hooks/useStats';

interface ViewModeSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewModeSwitcher({ viewMode, onViewModeChange }: ViewModeSwitcherProps) {
  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={viewMode}
        onValueChange={(value) => onViewModeChange(value as ViewMode)}
        buttons={[
          {
            value: 'day',
            label: 'Day',
            icon: 'calendar-today',
          },
          {
            value: 'week',
            label: 'Week',
            icon: 'calendar-week',
          },
          {
            value: 'month',
            label: 'Month',
            icon: 'calendar-month',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
