/**
 * useStats Hook
 * Manages stats data loading and calculations
 */

import { useState, useEffect, useMemo } from 'react';
import { DayAchievement, ActivityGoal } from '../types';
import * as storage from '../services/storageService';
import * as statsService from '../services/statsService';

export function useStats() {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionsByDate, setSessionsByDate] = useState(new Map());
  const [goals, setGoals] = useState<ActivityGoal[]>([]);
  const [activities, setActivities] = useState(new Map());
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const { start } = statsService.getCurrentWeekRange();
    return start;
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load all required data
      const [sessions, settings, activitiesList] = await Promise.all([
        storage.getTrackingSessions(),
        storage.getUserSettings(),
        storage.getActivities(),
      ]);

      // Group sessions by date
      const grouped = statsService.groupSessionsByDate(sessions);
      setSessionsByDate(grouped);

      // Set goals
      setGoals(settings.dailyGoals || []);

      // Create activities map for quick lookup
      const activityMap = new Map();
      activitiesList.forEach((activity) => {
        activityMap.set(activity.id, {
          name: activity.name,
          color: activity.color,
        });
      });
      setActivities(activityMap);
    } catch (error) {
      console.error('Failed to load stats data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate week achievements
  const weekAchievements = useMemo<DayAchievement[]>(() => {
    if (sessionsByDate.size === 0) return [];

    return statsService.calculateWeekAchievements(
      selectedWeekStart,
      sessionsByDate,
      goals,
      activities
    );
  }, [selectedWeekStart, sessionsByDate, goals, activities]);

  // Calculate overall streak
  const overallStreak = useMemo(() => {
    if (sessionsByDate.size === 0) return 0;

    return statsService.calculateOverallStreak(sessionsByDate, goals, activities);
  }, [sessionsByDate, goals, activities]);

  // Navigate to previous week
  const previousWeek = () => {
    const newStart = new Date(selectedWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setSelectedWeekStart(newStart);
  };

  // Navigate to next week
  const nextWeek = () => {
    const newStart = new Date(selectedWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setSelectedWeekStart(newStart);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    const { start } = statsService.getCurrentWeekRange();
    setSelectedWeekStart(start);
  };

  // Check if showing current week
  const isCurrentWeek = useMemo(() => {
    const { start } = statsService.getCurrentWeekRange();
    return statsService.formatDate(selectedWeekStart) === statsService.formatDate(start);
  }, [selectedWeekStart]);

  return {
    isLoading,
    weekAchievements,
    overallStreak,
    selectedWeekStart,
    previousWeek,
    nextWeek,
    goToCurrentWeek,
    isCurrentWeek,
    refreshData: loadData,
  };
}
