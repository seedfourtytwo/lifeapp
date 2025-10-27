/**
 * HomeScreen
 * Main screen showing activity grid and active timer
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { useActivityStore } from '../store/activityStore';
import { useActivityTimer, formatTime } from '../hooks/useActivityTimer';
import ActivityButton from '../components/ActivityButton';
import { Activity } from '../types';

export default function HomeScreen() {
  const { activities, loadActivities, isLoading } = useActivityStore();
  const {
    activeSession,
    elapsedSeconds,
    isRunning,
    isPaused,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer
  } = useActivityTimer();

  // Load activities and active session on mount
  useEffect(() => {
    loadActivities();
    useActivityStore.getState().loadActiveSession();
  }, []);

  const handleActivityPress = async (activity: Activity) => {
    try {
      if (isRunning) {
        // Stop current timer
        Alert.alert(
          'Stop Current Timer?',
          `Do you want to stop tracking "${activeSession?.activityName}" and start tracking "${activity.name}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Stop & Start New',
              onPress: async () => {
                await stopTimer();
                await startTimer(activity.id);
              },
            },
          ]
        );
      } else {
        // Start new timer
        await startTimer(activity.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start timer. Please try again.');
    }
  };

  const handleStopTimer = async () => {
    try {
      await stopTimer();
      Alert.alert('Success', 'Session saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to stop timer. Please try again.');
    }
  };

  const handlePauseTimer = async () => {
    try {
      await pauseTimer();
    } catch (error) {
      Alert.alert('Error', 'Failed to pause timer. Please try again.');
    }
  };

  const handleResumeTimer = async () => {
    try {
      await resumeTimer();
    } catch (error) {
      Alert.alert('Error', 'Failed to resume timer. Please try again.');
    }
  };

  const handleCancelTimer = async () => {
    try {
      Alert.alert(
        'Discard Session?',
        `Are you sure you want to discard this "${activeSession?.activityName}" session without saving?`,
        [
          { text: 'Keep Tracking', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await cancelTimer();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel timer. Please try again.');
    }
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <View style={styles.activityItem}>
      <ActivityButton
        activity={item}
        onPress={() => handleActivityPress(item)}
        isActive={activeSession?.activityId === item.id}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Active Timer Display */}
      {isRunning && activeSession && (
        <Card style={styles.timerCard} elevation={4}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.timerLabel}>
              Currently Tracking
            </Text>
            <Text variant="headlineLarge" style={styles.activityName}>
              {activeSession.activityName}
            </Text>
            <Text variant="displayMedium" style={[styles.timer, isPaused && styles.pausedTimer]}>
              {formatTime(elapsedSeconds)} {isPaused && '(Paused)'}
            </Text>
            <View style={styles.buttonRow}>
              {isPaused ? (
                <Button
                  mode="contained"
                  onPress={handleResumeTimer}
                  style={styles.actionButton}
                  buttonColor="#4CAF50"
                  icon="play"
                >
                  Resume
                </Button>
              ) : (
                <Button
                  mode="contained"
                  onPress={handlePauseTimer}
                  style={styles.actionButton}
                  buttonColor="#FF9800"
                  icon="pause"
                >
                  Pause
                </Button>
              )}
              <Button
                mode="contained"
                onPress={handleStopTimer}
                style={styles.actionButton}
                buttonColor="#4CAF50"
                icon="check"
              >
                Save
              </Button>
              <Button
                mode="outlined"
                onPress={handleCancelTimer}
                style={styles.actionButton}
                textColor="#F44336"
                icon="close"
              >
                Cancel
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Activity Grid */}
      <View style={styles.gridContainer}>
        <Text variant="titleLarge" style={styles.gridTitle}>
          {isRunning ? 'Switch Activity' : 'Select Activity'}
        </Text>

        <FlatList
          data={activities.sort((a, b) => a.order - b.order)}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text variant="bodyLarge">No activities yet</Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Go to Settings to add activities
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  timerCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
  },
  timerLabel: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 8,
  },
  activityName: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  timer: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 16,
  },
  pausedTimer: {
    color: '#FF9800',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  gridTitle: {
    marginTop: 8,
    marginBottom: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  grid: {
    paddingBottom: 16,
  },
  activityItem: {
    width: '33.33%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
  },
});
