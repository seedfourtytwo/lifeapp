/**
 * StatsScreen
 * Display statistics with day/week/month views and point system integration
 */

import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, IconButton, Button, Chip } from 'react-native-paper';
import { useStats } from '../hooks/useStats';
import { useActivityStore } from '../store/activityStore';
import ViewModeSwitcher from '../components/ViewModeSwitcher';
import DayCard from '../components/DayCard';
import EditDayDialog from '../components/EditDayDialog';
import { DayAchievement } from '../types';

export default function StatsScreen() {
  const {
    isLoading,
    viewMode,
    setViewMode,
    selectedDate,
    selectedMonthStart,
    currentDayAchievement,
    weekAchievements,
    monthAchievements,
    currentStreak,
    weeklyBonus,
    previousDay,
    nextDay,
    previousWeek,
    nextWeek,
    previousMonth,
    nextMonth,
    goToToday,
    isToday,
    isCurrentWeek,
    isCurrentMonth,
    refreshData,
  } = useStats();

  const { activities } = useActivityStore();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedDayForEdit, setSelectedDayForEdit] = useState<DayAchievement | null>(null);
  const [editDialogVisible, setEditDialogVisible] = useState(false);

  const selectedDay = selectedDayIndex !== null ? weekAchievements[selectedDayIndex] : null;

  const handleEditDay = (day: DayAchievement) => {
    setSelectedDayForEdit(day);
    setEditDialogVisible(true);
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatWeekRange = () => {
    if (weekAchievements.length === 0) return '';
    const firstDay = new Date(weekAchievements[0].date);
    const lastDay = new Date(weekAchievements[6].date);
    return `${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const formatMonth = () => {
    return selectedMonthStart.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Navigation handlers based on view mode
  const handlePrevious = () => {
    if (viewMode === 'day') previousDay();
    else if (viewMode === 'week') previousWeek();
    else previousMonth();
  };

  const handleNext = () => {
    if (viewMode === 'day') nextDay();
    else if (viewMode === 'week') nextWeek();
    else nextMonth();
  };

  const isCurrentPeriod = () => {
    if (viewMode === 'day') return isToday;
    if (viewMode === 'week') return isCurrentWeek;
    return isCurrentMonth;
  };

  const getCurrentLabel = () => {
    if (viewMode === 'day') return formatDate(selectedDate);
    if (viewMode === 'week') return formatWeekRange();
    return formatMonth();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshData} />}
    >
      {/* Header with streak and bonus */}
      <View style={styles.header}>
        <View style={styles.headerStats}>
          <View style={styles.streakBadge}>
            <Text variant="headlineMedium" style={styles.streakNumber}>
              🔥 {currentStreak}
            </Text>
            <Text variant="bodySmall" style={styles.streakLabel}>
              day streak
            </Text>
          </View>
          <View style={styles.bonusBadge}>
            <Text variant="headlineMedium" style={styles.bonusNumber}>
              ⭐ {weeklyBonus?.availableBonus || 0}
            </Text>
            <Text variant="bodySmall" style={styles.bonusLabel}>
              bonus points
            </Text>
          </View>
        </View>
      </View>

      {/* View Mode Switcher */}
      <ViewModeSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* Navigation bar with Jump to Today button */}
      <View style={styles.navigationBar}>
        <IconButton icon="chevron-left" size={24} onPress={handlePrevious} />
        <View style={styles.navigationCenter}>
          <Text variant="titleMedium" style={styles.periodLabel}>
            {getCurrentLabel()}
          </Text>
          {!isCurrentPeriod() && (
            <Button mode="text" compact onPress={goToToday} style={styles.todayButton}>
              Today
            </Button>
          )}
        </View>
        <IconButton icon="chevron-right" size={24} onPress={handleNext} disabled={isCurrentPeriod()} />
      </View>

      {/* DAY VIEW */}
      {viewMode === 'day' && currentDayAchievement && (
        <Card style={styles.detailsCard} elevation={2}>
          <Card.Content>
            <View style={styles.detailsHeader}>
              <View>
                <Text variant="headlineLarge" style={styles.dayPoints}>
                  {currentDayAchievement.points?.totalPoints || 0} pts
                </Text>
                <Text variant="bodySmall" style={styles.dayPointsBreakdown}>
                  {currentDayAchievement.points?.earnedPoints || 0} earned
                  {(currentDayAchievement.points?.bonusApplied || 0) > 0 &&
                    ` + ${currentDayAchievement.points?.bonusApplied} bonus`}
                </Text>
              </View>
              <IconButton icon="pencil" size={20} onPress={() => handleEditDay(currentDayAchievement)} />
            </View>

            {/* Activity breakdown */}
            {currentDayAchievement.activityBreakdown.length > 0 && (
              <>
                <Text variant="titleMedium" style={styles.breakdownTitle}>
                  Activity Breakdown
                </Text>
                {currentDayAchievement.activityBreakdown.map((activity) => (
                  <View key={activity.activityId} style={styles.activityRow}>
                    <View style={[styles.activityColor, { backgroundColor: activity.activityColor }]} />
                    <Text variant="bodyMedium" style={styles.activityName}>
                      {activity.activityName}
                    </Text>
                    <Text variant="bodyMedium" style={styles.activityTime}>
                      {formatTime(Math.round(activity.totalSeconds / 60))}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {currentDayAchievement.activityBreakdown.length === 0 && (
              <Text variant="bodyMedium" style={styles.noData}>
                No activities tracked today
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
            <View style={styles.weekContainer}>
              {weekAchievements.map((achievement, index) => {
                const date = new Date(achievement.date);
                const points = achievement.points?.totalPoints || 0;
                return (
                  <DayCard
                    key={achievement.date}
                    date={date}
                    points={points}
                    status={achievement.status}
                    isSelected={selectedDayIndex === index}
                    onPress={() => setSelectedDayIndex(selectedDayIndex === index ? null : index)}
                  />
                );
              })}
            </View>
          </ScrollView>

          {/* Day details (when day is selected in week view) */}
          {selectedDay && (
            <Card style={styles.detailsCard} elevation={2}>
              <Card.Content>
                <View style={styles.detailsHeader}>
                  <View>
                    <Text variant="titleLarge" style={styles.detailsTitle}>
                      {new Date(selectedDay.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text variant="headlineMedium" style={styles.dayPoints}>
                      {selectedDay.points?.totalPoints || 0} points
                    </Text>
                  </View>
                  <IconButton icon="pencil" size={20} onPress={() => handleEditDay(selectedDay)} />
                </View>

                {/* Activity breakdown */}
                {selectedDay.activityBreakdown.length > 0 && (
                  <>
                    <Text variant="titleMedium" style={styles.breakdownTitle}>
                      Activity Breakdown
                    </Text>
                    {selectedDay.activityBreakdown.map((activity) => (
                      <View key={activity.activityId} style={styles.activityRow}>
                        <View style={[styles.activityColor, { backgroundColor: activity.activityColor }]} />
                        <Text variant="bodyMedium" style={styles.activityName}>
                          {activity.activityName}
                        </Text>
                        <Text variant="bodyMedium" style={styles.activityTime}>
                          {formatTime(Math.round(activity.totalSeconds / 60))}
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
        </>
      )}

      {/* MONTH VIEW - Simple grid placeholder */}
      {viewMode === 'month' && (
        <View style={styles.monthPlaceholder}>
          <Text variant="headlineSmall" style={styles.placeholderText}>
            Month Calendar View
          </Text>
          <Text variant="bodyMedium" style={styles.placeholderSubtext}>
            Coming soon - will show calendar grid with daily points
          </Text>
        </View>
      )}

      {/* Edit Day Dialog */}
      {selectedDayForEdit && (
        <EditDayDialog
          visible={editDialogVisible}
          date={selectedDayForEdit.date}
          activities={activities}
          onDismiss={() => {
            setEditDialogVisible(false);
            setSelectedDayForEdit(null);
          }}
          onSave={() => {
            setEditDialogVisible(false);
            setSelectedDayForEdit(null);
            refreshData();
          }}
        />
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
    backgroundColor: '#FFFFFF',
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    marginTop: 4,
  },
  bonusBadge: {
    alignItems: 'center',
  },
  bonusNumber: {
    fontWeight: 'bold',
    color: '#FFC107',
  },
  bonusLabel: {
    color: '#666',
    marginTop: 4,
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  navigationCenter: {
    flex: 1,
    alignItems: 'center',
  },
  periodLabel: {
    fontWeight: '600',
  },
  todayButton: {
    marginTop: 4,
  },
  weekScroll: {
    marginVertical: 16,
  },
  weekContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  detailsCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailsTitle: {
    fontWeight: 'bold',
  },
  dayPoints: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  dayPointsBreakdown: {
    color: '#666',
    marginTop: 4,
  },
  breakdownTitle: {
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
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
  },
  noData: {
    textAlign: 'center',
    color: '#999',
    marginTop: 16,
  },
  monthPlaceholder: {
    padding: 32,
    alignItems: 'center',
    marginTop: 32,
  },
  placeholderText: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  placeholderSubtext: {
    color: '#999',
    textAlign: 'center',
  },
});
