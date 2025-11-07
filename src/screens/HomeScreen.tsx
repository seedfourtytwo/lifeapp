/**
 * HomeScreen (Life Page)
 * Main screen with Activity Tracker, Timer, and Todo sections
 * Now supports multiple concurrent activities!
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, List, Dialog, Portal } from 'react-native-paper';
import { useActivityStore } from '../store/activityStore';
import { useActivityTimers } from '../hooks/useActivityTimers';
import ActivityButton from '../components/ActivityButton';
import ActivityCard from '../components/ActivityCard';
import RunningActivityLane from '../components/RunningActivityLane';
import ActivityDetailsPanel from '../components/ActivityDetailsPanel';
import IntervalTimer from '../components/IntervalTimer';
import TodoList from '../components/TodoList';
import { Activity } from '../types';

export default function HomeScreen() {
  const [activityExpanded, setActivityExpanded] = useState(true);
  const [timerExpanded, setTimerExpanded] = useState(false);
  const [todoExpanded, setTodoExpanded] = useState(false);
  const [moreDialogVisible, setMoreDialogVisible] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const { activities, loadActivities } = useActivityStore();
  const {
    activeSessions,
    getSessionForActivity,
    isActivityRunning,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    toggleExpand,
  } = useActivityTimers();

  // Load activities and active sessions on mount
  useEffect(() => {
    loadActivities();
    useActivityStore.getState().loadActiveSessions();
  }, [loadActivities]);

  const handleActivityPress = async (activity: Activity) => {
    try {
      // If activity is already running, toggle its expanded state
      if (isActivityRunning(activity.id)) {
        await toggleExpand(activity.id);
        return;
      }

      // Start new timer
      await startTimer(activity.id);
    } catch (error: unknown) {
      const err = error as Error;
      Alert.alert('Error', err.message || 'Failed to start timer. Please try again.');
    }
  };

  const handleStopTimer = async (activityId: string) => {
    try {
      // Show confirmation dialog
      Alert.alert(
        'Stop Activity',
        'Save this session to your history?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await cancelTimer(activityId);
            },
          },
          {
            text: 'Save',
            onPress: async () => {
              await stopTimer(activityId);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to stop timer. Please try again.');
    }
  };

  const handlePauseTimer = async (activityId: string) => {
    try {
      await pauseTimer(activityId);
    } catch (error) {
      Alert.alert('Error', 'Failed to pause timer. Please try again.');
    }
  };

  const handleResumeTimer = async (activityId: string) => {
    try {
      await resumeTimer(activityId);
    } catch (error) {
      Alert.alert('Error', 'Failed to resume timer. Please try again.');
    }
  };

  const handleToggleExpand = async (activityId: string) => {
    // Toggle local expansion state (not persisted)
    setExpandedActivityId(expandedActivityId === activityId ? null : activityId);
  };

  // Combine activities with their sessions for rendering
  const getActivitiesForGrid = () => {
    const sortedActivities = activities.sort((a, b) => a.order - b.order);

    // Separate running and idle activities
    const runningActivities = sortedActivities.filter(a => isActivityRunning(a.id));
    const idleActivities = sortedActivities.filter(a => !isActivityRunning(a.id));

    // 4x4 grid = 16 slots total
    // If we have more than 15 idle activities, last slot shows "More"
    const maxVisible = 15;
    const hasMore = idleActivities.length > maxVisible;
    const displayIdleActivities = hasMore ? idleActivities.slice(0, maxVisible) : idleActivities;

    return {
      runningActivities,
      displayIdleActivities,
      hasMore,
      allActivities: sortedActivities,
    };
  };

  const { runningActivities, displayIdleActivities, hasMore, allActivities } = getActivitiesForGrid();

  return (
    <ScrollView style={styles.container}>
      {/* Activity Tracker Section */}
      <List.Accordion
        title="Activity Tracker"
        description={
          activeSessions.length > 0
            ? `Tracking ${activeSessions.length} ${activeSessions.length === 1 ? 'activity' : 'activities'}`
            : 'Track your daily activities'
        }
        expanded={activityExpanded}
        onPress={() => setActivityExpanded(!activityExpanded)}
        left={(props) => <List.Icon {...props} icon="play-circle" />}
        style={styles.accordion}
      >
        {activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge">No activities yet</Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Go to Settings to add activities
            </Text>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Running Activities - Horizontal Lanes */}
            {runningActivities.length > 0 && (
              <View style={styles.runningSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Running Activities
                </Text>
                {runningActivities.map((activity) => {
                  const session = getSessionForActivity(activity.id);
                  if (!session) return null;

                  const isExpanded = expandedActivityId === activity.id;

                  return (
                    <View key={activity.id}>
                      <RunningActivityLane
                        activity={activity}
                        session={session}
                        onPause={() => handlePauseTimer(activity.id)}
                        onResume={() => handleResumeTimer(activity.id)}
                        onStop={() => handleStopTimer(activity.id)}
                        onToggleExpand={() => handleToggleExpand(activity.id)}
                      />
                      <ActivityDetailsPanel activity={activity} isExpanded={isExpanded} />
                    </View>
                  );
                })}
              </View>
            )}

            {/* Idle Activities - 4x4 Grid */}
            {displayIdleActivities.length > 0 && (
              <View style={styles.idleSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Start Activity
                </Text>
                <View style={styles.grid}>
                  {displayIdleActivities.map((activity) => (
                    <View key={activity.id} style={styles.gridItem}>
                      <ActivityCard activity={activity} onPress={() => handleActivityPress(activity)} />
                    </View>
                  ))}

                  {/* More button */}
                  {hasMore && (
                    <View key="more" style={styles.gridItem}>
                      <TouchableOpacity
                        style={styles.moreButton}
                        onPress={() => setMoreDialogVisible(true)}
                        accessible={true}
                        accessibilityLabel="View more activities"
                        accessibilityRole="button"
                      >
                        <Text style={styles.moreButtonText}>•••</Text>
                        <Text style={styles.moreButtonLabel}>More</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </List.Accordion>

      {/* Timer Section */}
      <List.Accordion
        title="Interval Timer"
        description="Workout & cooking timer with rounds"
        expanded={timerExpanded}
        onPress={() => setTimerExpanded(!timerExpanded)}
        left={(props) => <List.Icon {...props} icon="timer" />}
        style={styles.accordion}
      >
        <View style={styles.sectionContent}>
          <IntervalTimer />
        </View>
      </List.Accordion>

      {/* Todo Section */}
      <List.Accordion
        title="Todo List"
        description="Track your daily tasks and goals"
        expanded={todoExpanded}
        onPress={() => setTodoExpanded(!todoExpanded)}
        left={(props) => <List.Icon {...props} icon="checkbox-marked-circle" />}
        style={styles.accordion}
      >
        <TodoList />
      </List.Accordion>

      {/* More Activities Dialog */}
      <Portal>
        <Dialog visible={moreDialogVisible} onDismiss={() => setMoreDialogVisible(false)}>
          <Dialog.Title>All Activities</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.moreDialog}>
              <View style={styles.moreGrid}>
                {allActivities.map((activity) => {
                  const session = getSessionForActivity(activity.id);
                  return (
                    <View key={activity.id} style={styles.moreActivityItem}>
                      <ActivityButton
                        activity={activity}
                        activeSession={session}
                        onPress={() => {
                          handleActivityPress(activity);
                          setMoreDialogVisible(false);
                        }}
                        onPause={() => handlePauseTimer(activity.id)}
                        onResume={() => handleResumeTimer(activity.id)}
                        onStop={() => handleStopTimer(activity.id)}
                        onToggleExpand={() => handleToggleExpand(activity.id)}
                      />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setMoreDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  accordion: {
    backgroundColor: '#FFFFFF',
    marginBottom: 2,
  },
  sectionContent: {
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingBottom: 16,
  },
  runningSection: {
    paddingTop: 16,
    gap: 8,
  },
  idleSection: {
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    paddingHorizontal: 8,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '25%', // 4x4 grid
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
  },
  moreButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 16,
    margin: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#607D8B',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  moreButtonText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  moreButtonLabel: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  moreDialog: {
    paddingHorizontal: 16,
    maxHeight: 400,
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 16,
  },
  moreActivityItem: {
    width: '25%', // Match 4x4 grid in dialog
  },
});
