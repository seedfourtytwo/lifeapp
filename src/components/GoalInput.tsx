/**
 * GoalInput Component
 * Input for setting daily goal in hours and minutes for an activity
 */

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Switch, TextInput } from 'react-native-paper';
import { Activity, ActivityGoal } from '../types';

interface GoalInputProps {
  activity: Activity;
  goal: ActivityGoal | undefined;
  onUpdate: (enabled: boolean, minutes: number) => void;
}

export default function GoalInput({ activity, goal, onUpdate }: GoalInputProps) {
  // Calculate initial hours and minutes
  const totalMinutes = goal?.minimumMinutes || 30;
  const initialHours = Math.floor(totalMinutes / 60);
  const initialMinutes = totalMinutes % 60;

  // Local state to prevent typing interference
  const [enabled, setEnabled] = useState(goal?.enabled || false);
  const [hours, setHours] = useState(initialHours.toString());
  const [minutes, setMinutes] = useState(initialMinutes.toString());

  // Sync with prop changes
  useEffect(() => {
    setEnabled(goal?.enabled || false);
    const newTotalMinutes = goal?.minimumMinutes || 30;
    setHours(Math.floor(newTotalMinutes / 60).toString());
    setMinutes((newTotalMinutes % 60).toString());
  }, [goal]);

  const handleToggle = useCallback(() => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    const totalMins = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    onUpdate(newEnabled, totalMins);
  }, [enabled, hours, minutes, onUpdate]);

  const handleHoursBlur = useCallback(() => {
    const hoursNum = Math.max(0, Math.min(23, parseInt(hours) || 0));
    setHours(hoursNum.toString());
    const totalMins = hoursNum * 60 + (parseInt(minutes) || 0);
    onUpdate(enabled, totalMins);
  }, [hours, minutes, enabled, onUpdate]);

  const handleMinutesBlur = useCallback(() => {
    const minutesNum = Math.max(0, Math.min(59, parseInt(minutes) || 0));
    setMinutes(minutesNum.toString());
    const totalMins = (parseInt(hours) || 0) * 60 + minutesNum;
    onUpdate(enabled, totalMins);
  }, [hours, minutes, enabled, onUpdate]);

  return (
    <View style={styles.container}>
      <View style={[styles.colorIndicator, { backgroundColor: activity.color }]} />
      <Text variant="bodyLarge" style={styles.activityName}>
        {activity.name}
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          value={hours}
          onChangeText={setHours}
          onBlur={handleHoursBlur}
          keyboardType="number-pad"
          style={styles.timeInput}
          disabled={!enabled}
          dense
          placeholder="0"
          right={<TextInput.Affix text="h" />}
        />
        <TextInput
          mode="outlined"
          value={minutes}
          onChangeText={setMinutes}
          onBlur={handleMinutesBlur}
          keyboardType="number-pad"
          style={styles.timeInput}
          disabled={!enabled}
          dense
          placeholder="0"
          right={<TextInput.Affix text="m" />}
        />
        <Switch value={enabled} onValueChange={handleToggle} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  activityName: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    width: 70,
    height: 40,
  },
});
