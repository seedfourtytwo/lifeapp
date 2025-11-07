/**
 * usePoints Hook
 * React hook for managing points, bonus, and streak data
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DailyPoints,
  WeeklyBonus,
  StreakData,
  PointBreakdown,
} from '../types';
import * as pointsService from '../services/pointsService';
import * as storage from '../services/storageService';

export function usePoints(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  const [dailyPoints, setDailyPoints] = useState<DailyPoints | null>(null);
  const [weeklyBonus, setWeeklyBonus] = useState<WeeklyBonus | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all point data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [points, bonus, streakData] = await Promise.all([
        storage.getDailyPoints(targetDate),
        storage.getCurrentWeeklyBonus(),
        storage.getStreakData(),
      ]);

      // If no points exist yet, calculate them
      if (!points) {
        const calculated = await pointsService.calculateDailyPoints(targetDate);
        setDailyPoints(calculated);
      } else {
        setDailyPoints(points);
      }

      setWeeklyBonus(bonus);
      setStreak(streakData);
    } catch (err) {
      console.error('Error loading points data:', err);
      setError('Failed to load points data');
    } finally {
      setIsLoading(false);
    }
  }, [targetDate]);

  // Load data on mount and when date changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recalculate points for the current day
  const recalculateDay = useCallback(async (recalcDate?: string) => {
    try {
      const dateToRecalc = recalcDate || targetDate;
      await pointsService.recalculateDayPoints(dateToRecalc);
      await loadData();
    } catch (err) {
      console.error('Error recalculating points:', err);
      setError('Failed to recalculate points');
      throw err;
    }
  }, [targetDate, loadData]);

  // Apply bonus points to the current day
  const applyBonus = useCallback(async (amount: number, applyToDate?: string) => {
    try {
      const dateToApply = applyToDate || targetDate;
      await pointsService.applyBonusToDay(dateToApply, amount);
      await loadData();
    } catch (err: any) {
      console.error('Error applying bonus:', err);
      setError(err.message || 'Failed to apply bonus');
      throw err;
    }
  }, [targetDate, loadData]);

  // Get point breakdown for display
  const getPointBreakdown = useCallback((): PointBreakdown[] => {
    return dailyPoints?.breakdown || [];
  }, [dailyPoints]);

  // Calculate how much bonus is needed to reach 100 points
  const bonusNeededForGoal = dailyPoints
    ? Math.max(0, 100 - dailyPoints.totalPoints)
    : 0;

  // Check if user can apply bonus
  const canApplyBonus = weeklyBonus
    ? weeklyBonus.availableBonus > 0 && bonusNeededForGoal > 0
    : false;

  // Get available bonus
  const availableBonus = weeklyBonus?.availableBonus || 0;

  return {
    // Data
    dailyPoints,
    weeklyBonus,
    streak,
    isLoading,
    error,

    // Actions
    recalculateDay,
    applyBonus,
    getPointBreakdown,
    refreshData: loadData,

    // Computed values
    canApplyBonus,
    bonusNeededForGoal,
    availableBonus,
    earnedPoints: dailyPoints?.earnedPoints || 0,
    totalPoints: dailyPoints?.totalPoints || 0,
    reachedGoal: dailyPoints?.reachedGoal || false,
    currentStreak: streak?.currentStreak || 0,
    longestStreak: streak?.longestStreak || 0,
  };
}
