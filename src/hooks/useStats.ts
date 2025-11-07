/**
 * useStats Hook
 * Manages stats data loading and calculations with day/week/month views
 */

import { useState, useEffect, useMemo } from 'react';
import { DayAchievement, ActivityGoal, StreakData, WeeklyBonus } from '../types';
import * as storage from '../services/storageService';
import * as statsService from '../services/statsService';
import * as pointsService from '../services/pointsService';

export type ViewMode = 'day' | 'week' | 'month';

export function useStats() {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionsByDate, setSessionsByDate] = useState(new Map());
  const [goals, setGoals] = useState<ActivityGoal[]>([]);
  const [activities, setActivities] = useState(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [weeklyBonus, setWeeklyBonus] = useState<WeeklyBonus | null>(null);
  const [dailyPointsMap, setDailyPointsMap] = useState(new Map());

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load all required data
      const [sessions, settings, activitiesList, streakData, bonusData] = await Promise.all([
        storage.getTrackingSessions(),
        storage.getUserSettings(),
        storage.getActivities(),
        storage.getStreakData(),
        storage.getCurrentWeeklyBonus(),
      ]);

      // Group sessions by date
      const grouped = statsService.groupSessionsByDate(sessions);
      setSessionsByDate(grouped);

      // Set goals
      setGoals(settings.dailyGoals || []);

      // Set streak and bonus
      setStreak(streakData);
      setWeeklyBonus(bonusData);

      // Create activities map for quick lookup
      const activityMap = new Map();
      activitiesList.forEach((activity) => {
        activityMap.set(activity.id, {
          name: activity.name,
          color: activity.color,
          isNegative: activity.isNegative || false,
        });
      });
      setActivities(activityMap);

      // Load daily points for last 90 days
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 90);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30); // Include future dates

      const dailyPointsList = await storage.getDailyPointsRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Convert to Map for quick lookup
      const pointsMap = new Map();
      dailyPointsList.forEach((dp) => {
        pointsMap.set(dp.date, dp);
      });
      setDailyPointsMap(pointsMap);
    } catch (error) {
      console.error('Failed to load stats data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: Format date to YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Helper: Get week start (Monday)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Helper: Get month start
  const getMonthStart = (date: Date): Date => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Get current selected week start
  const selectedWeekStart = useMemo(() => {
    return viewMode === 'week' ? getWeekStart(selectedDate) : new Date();
  }, [viewMode, selectedDate]);

  // Get current selected month start
  const selectedMonthStart = useMemo(() => {
    return viewMode === 'month' ? getMonthStart(selectedDate) : new Date();
  }, [viewMode, selectedDate]);

  // Calculate current day achievement (for day view)
  const currentDayAchievement = useMemo<DayAchievement | null>(() => {
    if (viewMode !== 'day') return null;

    const dateStr = formatDate(selectedDate);
    return statsService.calculateDayAchievement(
      dateStr,
      sessionsByDate,
      goals,
      activities,
      dailyPointsMap
    );
  }, [viewMode, selectedDate, sessionsByDate, goals, activities, dailyPointsMap]);

  // Calculate week achievements (for week view)
  const weekAchievements = useMemo<DayAchievement[]>(() => {
    if (viewMode !== 'week' || sessionsByDate.size === 0) return [];

    return statsService.calculateWeekAchievements(
      selectedWeekStart,
      sessionsByDate,
      goals,
      activities,
      dailyPointsMap
    );
  }, [viewMode, selectedWeekStart, sessionsByDate, goals, activities, dailyPointsMap]);

  // Calculate month achievements (for month view)
  const monthAchievements = useMemo<DayAchievement[]>(() => {
    if (viewMode !== 'month') return [];

    const year = selectedMonthStart.getFullYear();
    const month = selectedMonthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const achievements: DayAchievement[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);

      achievements.push(
        statsService.calculateDayAchievement(dateStr, sessionsByDate, goals, activities, dailyPointsMap)
      );
    }

    return achievements;
  }, [viewMode, selectedMonthStart, sessionsByDate, goals, activities, dailyPointsMap]);

  // Navigation: Day view
  const previousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const nextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  // Navigation: Week view
  const previousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  // Navigation: Month view
  const previousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Check if currently viewing today
  const isToday = useMemo(() => {
    const today = new Date();
    return formatDate(selectedDate) === formatDate(today);
  }, [selectedDate]);

  // Check if showing current week
  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const currentWeekStart = getWeekStart(today);
    return formatDate(selectedWeekStart) === formatDate(currentWeekStart);
  }, [selectedWeekStart]);

  // Check if showing current month
  const isCurrentMonth = useMemo(() => {
    const today = new Date();
    return (
      selectedMonthStart.getMonth() === today.getMonth() &&
      selectedMonthStart.getFullYear() === today.getFullYear()
    );
  }, [selectedMonthStart]);

  // Get current streak (use stored streak data)
  const currentStreak = useMemo(() => {
    return streak?.currentStreak || 0;
  }, [streak]);

  return {
    // Loading state
    isLoading,

    // View mode
    viewMode,
    setViewMode,

    // Selected date/period
    selectedDate,
    selectedWeekStart,
    selectedMonthStart,

    // Achievement data by view
    currentDayAchievement,
    weekAchievements,
    monthAchievements,

    // Point system data
    currentStreak,
    weeklyBonus,

    // Navigation functions
    previousDay,
    nextDay,
    previousWeek,
    nextWeek,
    previousMonth,
    nextMonth,
    goToToday,

    // Current period checks
    isToday,
    isCurrentWeek,
    isCurrentMonth,

    // Data refresh
    refreshData: loadData,

    // Raw data access (for components that need it)
    activities,
  };
}
