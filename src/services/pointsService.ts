/**
 * Points Service
 * Handles all point calculation logic for the gamification system
 */

import type {
  DailyPoints,
  PointBreakdown,
  WeeklyBonus,
  StreakData,
  Activity,
  Todo,
  ActivityGoal,
} from '../types';
import * as storage from './storageService';

/**
 * Calculate daily points from activities and todos
 * All-or-nothing: activities award full points only when 100% of goal is reached
 * Negative activities deduct points per minute tracked
 */
export async function calculateDailyPoints(date: string): Promise<DailyPoints> {
  const breakdown: PointBreakdown[] = [];
  let totalEarnedPoints = 0;

  // Get all data for the day
  const [activities, sessions, todos, userSettings] = await Promise.all([
    storage.getActivities(),
    storage.getSessionsByDate(date),
    storage.getTodos(),
    storage.getUserSettings(),
  ]);

  const goals = userSettings.dailyGoals || [];

  // Calculate activity points
  for (const activity of activities) {
    const activitySessions = sessions.filter((s) => s.activityId === activity.id);
    const totalSeconds = activitySessions.reduce((sum, s) => sum + s.durationSeconds, 0);

    if (totalSeconds === 0) continue;

    // Find goal for this activity
    const goal = goals.find((g) => g.activityId === activity.id && g.enabled);

    if (goal && !activity.isNegative) {
      // Positive activity with goal
      const goalSeconds = goal.minimumMinutes * 60;
      const goalMet = totalSeconds >= goalSeconds;
      const points = goalMet ? (activity.goalPoints || 10) : 0;

      breakdown.push({
        source: 'activity',
        sourceId: activity.id,
        sourceName: activity.name,
        points,
        goalMet,
        timeSpent: totalSeconds,
        goalTime: goalSeconds,
      });

      totalEarnedPoints += points;
    } else if (activity.isNegative) {
      // Negative activity - deduct points per minute
      const minutes = Math.floor(totalSeconds / 60);
      const pointsPerMinute = activity.negativePointsPerMinute || 0.5;
      const points = -(minutes * pointsPerMinute);

      breakdown.push({
        source: 'activity',
        sourceId: activity.id,
        sourceName: activity.name,
        points,
        goalMet: false,
        timeSpent: totalSeconds,
      });

      totalEarnedPoints += points;
    }
  }

  // Calculate todo points
  const completedTodosForDay = todos.filter((todo) => {
    if (!todo.completed || !todo.completedAt) return false;
    const completedDate = todo.completedAt.split('T')[0];
    return completedDate === date;
  });

  for (const todo of completedTodosForDay) {
    if (todo.points > 0) {
      breakdown.push({
        source: 'todo',
        sourceId: todo.id,
        sourceName: todo.title,
        points: todo.points,
        goalMet: true,
      });

      totalEarnedPoints += todo.points;
    }
  }

  // Check if bonus was already applied
  const existingDailyPoints = await storage.getDailyPoints(date);
  const bonusApplied = existingDailyPoints?.bonusApplied || 0;

  const dailyPoints: DailyPoints = {
    date,
    earnedPoints: Math.round(totalEarnedPoints),
    bonusApplied,
    totalPoints: Math.round(totalEarnedPoints + bonusApplied),
    reachedGoal: Math.round(totalEarnedPoints + bonusApplied) >= 100,
    breakdown,
  };

  // Save to storage
  await storage.saveDailyPoints(dailyPoints);

  return dailyPoints;
}

/**
 * Apply bonus points to a specific day (manual action by user)
 */
export async function applyBonusToDay(date: string, bonusAmount: number): Promise<void> {
  if (bonusAmount <= 0) {
    throw new Error('Bonus amount must be positive');
  }

  // Get current weekly bonus
  const weeklyBonus = await storage.getCurrentWeeklyBonus();

  if (weeklyBonus.availableBonus < bonusAmount) {
    throw new Error(`Not enough bonus available. You have ${weeklyBonus.availableBonus} points.`);
  }

  // Get or calculate current daily points
  let dailyPoints = await storage.getDailyPoints(date);
  if (!dailyPoints) {
    dailyPoints = await calculateDailyPoints(date);
  }

  // Apply bonus
  dailyPoints.bonusApplied += bonusAmount;
  dailyPoints.totalPoints = dailyPoints.earnedPoints + dailyPoints.bonusApplied;
  dailyPoints.reachedGoal = dailyPoints.totalPoints >= 100;

  // Update weekly bonus
  weeklyBonus.availableBonus -= bonusAmount;
  weeklyBonus.usedBonus += bonusAmount;

  // Update daily breakdown
  const dayBreakdown = weeklyBonus.dailyBreakdown.find((d) => d.date === date);
  if (dayBreakdown) {
    dayBreakdown.used += bonusAmount;
  } else {
    weeklyBonus.dailyBreakdown.push({
      date,
      earned: 0,
      used: bonusAmount,
    });
  }

  // Save changes
  await Promise.all([
    storage.saveDailyPoints(dailyPoints),
    storage.saveWeeklyBonus(weeklyBonus),
  ]);

  // Recalculate streak since bonus application might affect it
  await updateStreak(date, dailyPoints);
}

/**
 * Calculate bonus earned from daily points
 * Bonus = points over 100 (capped by weekly limit)
 */
export function calculateBonusEarned(dailyPoints: DailyPoints): number {
  if (dailyPoints.totalPoints <= 100) {
    return 0;
  }
  return dailyPoints.totalPoints - 100;
}

/**
 * Update weekly bonus after earning points
 */
export async function addBonusToWeek(date: string, bonusEarned: number): Promise<void> {
  if (bonusEarned <= 0) return;

  const weeklyBonus = await storage.getCurrentWeeklyBonus();

  // Add to available bonus (with weekly cap of 200 points)
  const WEEKLY_CAP = 200;
  weeklyBonus.availableBonus = Math.min(
    weeklyBonus.availableBonus + bonusEarned,
    WEEKLY_CAP
  );

  // Update daily breakdown
  const dayBreakdown = weeklyBonus.dailyBreakdown.find((d) => d.date === date);
  if (dayBreakdown) {
    dayBreakdown.earned += bonusEarned;
  } else {
    weeklyBonus.dailyBreakdown.push({
      date,
      earned: bonusEarned,
      used: 0,
    });
  }

  await storage.saveWeeklyBonus(weeklyBonus);
}

/**
 * Update streak based on point achievement
 * Streak continues if totalPoints >= 100 (including applied bonus)
 * Hard reset to 0 if goal not reached
 */
export async function updateStreak(date: string, dailyPoints: DailyPoints): Promise<number> {
  const streakData = await storage.getStreakData();
  const yesterday = getYesterday(date);

  // Check if this is a continuation or break
  const isGoalReached = dailyPoints.totalPoints >= 100;

  if (isGoalReached) {
    // Check if this continues from yesterday
    if (streakData.lastUpdateDate === yesterday) {
      // Continue streak
      streakData.currentStreak += 1;
    } else if (streakData.lastUpdateDate === date) {
      // Same day update (e.g., after applying bonus) - don't increment
      // Streak stays the same
    } else {
      // Gap in days or first time - start new streak
      streakData.currentStreak = 1;
    }

    // Update longest streak
    if (streakData.currentStreak > streakData.longestStreak) {
      streakData.longestStreak = streakData.currentStreak;
    }

    streakData.lastUpdateDate = date;
  } else {
    // Goal not reached - check if we should reset streak
    if (streakData.lastUpdateDate === yesterday && streakData.currentStreak > 0) {
      // Break the streak
      streakData.currentStreak = 0;
      streakData.lastUpdateDate = date;
    }
  }

  await storage.saveStreakData(streakData);
  return streakData.currentStreak;
}

/**
 * Get currently available bonus points
 */
export async function getAvailableBonus(): Promise<number> {
  const weeklyBonus = await storage.getCurrentWeeklyBonus();
  return weeklyBonus.availableBonus;
}

/**
 * Recalculate points for a date (e.g., after activity completion or todo completion)
 */
export async function recalculateDayPoints(date: string): Promise<void> {
  const dailyPoints = await calculateDailyPoints(date);

  // Check if bonus was earned
  const bonusEarned = calculateBonusEarned(dailyPoints);
  if (bonusEarned > 0) {
    await addBonusToWeek(date, bonusEarned);
  }

  // Update streak
  await updateStreak(date, dailyPoints);
}

/**
 * Helper: Get yesterday's date in YYYY-MM-DD format
 */
function getYesterday(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Check if a new week has started and reset bonus if needed
 */
export async function checkAndResetWeeklyBonus(): Promise<void> {
  // Check if a new week has started
  // getCurrentWeeklyBonus will automatically create new week entry if needed
  // No action needed - old week bonus is archived
  await storage.getCurrentWeeklyBonus();
}
