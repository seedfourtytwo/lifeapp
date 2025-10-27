/**
 * StatsScreen
 * Display statistics with horizontal week view and goal tracking
 */

import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, IconButton } from 'react-native-paper';
import { useStats } from '../hooks/useStats';
import DayCard from '../components/DayCard';
import { DayAchievement } from '../types';

export default function StatsScreen() {
  const {
    isLoading,
    weekAchievements,
    overallStreak,
    selectedWeekStart,
    previousWeek,
    nextWeek,
    isCurrentWeek,
    refreshData,
  } = useStats();

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const selectedDay = selectedDayIndex !== null ? weekAchievements[selectedDayIndex] : null;

  const formatWeekRange = () => {
    if (weekAchievements.length === 0) return '';
    const firstDay = new Date(weekAchievements[0].date);
    const lastDay = new Date(weekAchievements[6].date);
    return `${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshData} />}
    >
      {/* Header with streak */}
      <View style={styles.header}>
        <View style={styles.streakBadge}>
          <Text variant="headlineSmall" style={styles.streakNumber}>
            🔥 {overallStreak}
          </Text>
          <Text variant="bodySmall" style={styles.streakLabel}>
            day streak
          </Text>
        </View>
      </View>

      {/* Week navigation */}
      <View style={styles.weekNavigation}>
        <IconButton icon="chevron-left" size={24} onPress={previousWeek} />
        <Text variant="titleMedium" style={styles.weekRange}>
          {formatWeekRange()}
        </Text>
        <IconButton icon="chevron-right" size={24} onPress={nextWeek} disabled={isCurrentWeek} />
      </View>

      {/* Horizontal week view */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
        <View style={styles.weekContainer}>
          {weekAchievements.map((achievement, index) => {
            const date = new Date(achievement.date);
            return (
              <DayCard
                key={achievement.date}
                date={date}
                score={achievement.score}
                status={achievement.status}
                isSelected={selectedDayIndex === index}
                onPress={() =>
                  setSelectedDayIndex(selectedDayIndex === index ? null : index)
                }
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Day details (when day is selected) */}
      {selectedDay && (
        <Card style={styles.detailsCard} elevation={2}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.detailsTitle}>
              {new Date(selectedDay.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {formatTime(selectedDay.totalMinutesTracked)}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Total Time
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {selectedDay.goalsCompleted}/{selectedDay.totalGoals}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Goals Met
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {selectedDay.score}%
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Score
                </Text>
              </View>
            </View>

            {/* Activity breakdown */}
            {selectedDay.activityBreakdown.length > 0 && (
              <>
                <Text variant="titleMedium" style={styles.breakdownTitle}>
                  Activity Breakdown
                </Text>
                {selectedDay.activityBreakdown.map((activity) => (
                  <View key={activity.activityId} style={styles.activityRow}>
                    <View
                      style={[styles.activityColor, { backgroundColor: activity.activityColor }]}
                    />
                    <Text variant="bodyMedium" style={styles.activityName}>
                      {activity.activityName}
                    </Text>
                    <Text variant="bodyMedium" style={styles.activityTime}>
                      {formatTime(activity.totalSeconds / 60)}
                    </Text>
                    <Text variant="bodySmall" style={styles.activityPercentage}>
                      ({Math.round(activity.percentage)}%)
                    </Text>
                  </View>
                ))}
              </>
            )}

            {selectedDay.activityBreakdown.length === 0 && (
              <Text variant="bodyMedium" style={styles.noData}>
                No activities tracked this day
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && weekAchievements.length === 0 && (
        <View style={styles.emptyState}>
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No Stats Yet
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Start tracking activities to see your stats!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  streakBadge: {
    alignItems: 'center',
  },
  streakNumber: {
    fontWeight: 'bold',
    color: '#FF5722',
  },
  streakLabel: {
    color: '#666',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  weekRange: {
    fontWeight: '600',
  },
  weekScroll: {
    marginBottom: 16,
  },
  weekContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  detailsCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
  },
  detailsTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  breakdownTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  activityName: {
    flex: 1,
  },
  activityTime: {
    fontWeight: '600',
    marginRight: 8,
  },
  activityPercentage: {
    color: '#666',
  },
  noData: {
    textAlign: 'center',
    color: '#999',
    marginTop: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 64,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
});
