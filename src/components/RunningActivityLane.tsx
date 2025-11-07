/**
 * RunningActivityLane Component
 * Full-width horizontal lane for running activities
 */

import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Activity, ActiveSession } from '../types';

interface RunningActivityLaneProps {
  activity: Activity;
  session: ActiveSession;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onToggleExpand: () => void;
}

function RunningActivityLane({
  activity,
  session,
  onPause,
  onResume,
  onStop,
  onToggleExpand,
}: RunningActivityLaneProps) {
  // Format timer display (HH:MM:SS or MM:SS)
  const formatTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleMainPress = useCallback(() => {
    onToggleExpand();
  }, [onToggleExpand]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.mainContent}
        onPress={handleMainPress}
        accessible={true}
        accessibilityLabel={`${activity.name} timer, ${session.isPaused ? 'paused' : 'running'}, ${formatTime(session.elapsedSeconds)}`}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        {/* Activity Icon & Name */}
        <View style={styles.activityInfo}>
          <View style={[styles.iconContainer, { backgroundColor: activity.color }]}>
            <Icon name={activity.icon as any} size={24} color="#FFFFFF" />
          </View>
          <Text variant="titleMedium" style={styles.activityName}>
            {activity.name}
          </Text>
        </View>

        {/* Timer Display */}
        <Text variant="headlineSmall" style={styles.timer}>
          {formatTime(session.elapsedSeconds)}
        </Text>
      </TouchableOpacity>

      {/* Controls */}
      <View style={styles.controls}>
        <IconButton
          icon={session.isPaused ? 'play' : 'pause'}
          size={28}
          onPress={session.isPaused ? onResume : onPause}
          iconColor="#4CAF50"
          accessible={true}
          accessibilityLabel={session.isPaused ? 'Resume timer' : 'Pause timer'}
        />
        <IconButton
          icon="stop"
          size={28}
          onPress={onStop}
          iconColor="#F44336"
          accessible={true}
          accessibilityLabel="Stop timer"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityName: {
    fontWeight: '600',
  },
  timer: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export default React.memo(RunningActivityLane);
