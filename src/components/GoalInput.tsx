/**
 * GoalInput Component
 * Input for setting daily goal minutes for an activity
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Switch, TextInput } from 'react-native-paper';
import { Activity, ActivityGoal } from '../types';

interface GoalInputProps {
  activity: Activity;
  goal: ActivityGoal | undefined;
  onUpdate: (enabled: boolean, minutes: number) => void;
}

export default function GoalInput({ activity, goal, onUpdate }: GoalInputProps) {
  const enabled = goal?.enabled || false;
  const minutes = goal?.minimumMinutes || 30;

  const handleToggle = () => {
    onUpdate(!enabled, minutes);
  };

  const handleMinutesChange = (text: string) => {
    const value = parseInt(text) || 0;
    const clampedValue = Math.max(0, Math.min(999, value));
    onUpdate(enabled, clampedValue);
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.colorIndicator, { backgroundColor: activity.color }]}
      />
      <Text variant="bodyLarge" style={styles.activityName}>
        {activity.name}
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          value={enabled ? minutes.toString() : '0'}
          onChangeText={handleMinutesChange}
          keyboardType="number-pad"
          style={styles.input}
          disabled={!enabled}
          dense
          right={<TextInput.Affix text="min" />}
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
    gap: 12,
  },
  input: {
    width: 100,
    height: 40,
  },
});
