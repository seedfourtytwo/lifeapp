/**
 * Stats Service
 * Handles all statistics calculations and data aggregation
 */

import { TrackingSession, ActivityGoal, DayAchievement, ActivityStats, DailyPoints } from '../types';

/**
 * Group sessions by date for efficient lookups
 */
export function groupSessionsByDate(sessions: TrackingSession[]): Map<string, TrackingSession[]> {
  const grouped = new Map<string, TrackingSession[]>();

  sessions.forEach((session) => {
    const date = session.date;
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(session);
  });

  return grouped;
}

/**
 * Calculate total minutes for an activity on a specific date
 */
function calculateActivityMinutes(sessions: TrackingSession[], activityId: string): number {
  return sessions
    .filter((s) => s.activityId === activityId)
    .reduce((total, s) => total + s.durationSeconds, 0) / 60;
}

/**
 * Calculate achievement for a single day
 * Now integrates with point system
 */
export function calculateDayAchievement(
  date: string,
  sessionsByDate: Map<string, TrackingSession[]>,
  goals: ActivityGoal[],
  activities: Map<string, { name: string; color: string; isNegative?: boolean }>,
  dailyPointsMap?: Map<string, DailyPoints>
): DayAchievement {
  const sessions = sessionsByDate.get(date) || [];
  const enabledGoals = goals.filter((g) => g.enabled);

  // Calculate activity breakdown
  const activityMap = new Map<string, { minutes: number; sessions: number }>();
  sessions.forEach((session) => {
    const minutes = session.durationSeconds / 60;
    if (!activityMap.has(session.activityId)) {
      activityMap.set(session.activityId, { minutes: 0, sessions: 0 });
    }
    const stats = activityMap.get(session.activityId)!;
    stats.minutes += minutes;
    stats.sessions += 1;
  });

  const totalMinutesTracked = Array.from(activityMap.values()).reduce(
    (sum, stat) => sum + stat.minutes,
    0
  );

  // Build activity breakdown
  const activityBreakdown: ActivityStats[] = Array.from(activityMap.entries()).map(
    ([activityId, stats]) => {
      const activity = activities.get(activityId);
      return {
        activityId,
        activityName: activity?.name || 'Unknown',
        activityColor: activity?.color || '#666',
        totalSeconds: Math.round(stats.minutes * 60),
        sessionCount: stats.sessions,
        percentage: totalMinutesTracked > 0 ? (stats.minutes / totalMinutesTracked) * 100 : 0,
      };
    }
  );

  // Calculate goal completion (for backward compatibility)
  let goalsCompleted = 0;
  enabledGoals.forEach((goal) => {
    const actualMinutes = calculateActivityMinutes(sessions, goal.activityId);
    if (actualMinutes >= goal.minimumMinutes) {
      goalsCompleted += 1;
    }
  });

  // Get DailyPoints if available
  const dailyPoints = dailyPointsMap?.get(date);

  // Determine status based on points (or fallback to goal completion)
  let status: 'excellent' | 'good' | 'poor';
  const totalPoints = dailyPoints?.totalPoints || 0;

  if (totalPoints >= 100) {
    status = 'excellent';
  } else if (totalPoints >= 80) {
    status = 'good';
  } else {
    status = 'poor';
  }

  // Legacy score for backward compatibility (show points as score, capped at 100 for display)
  const score = totalPoints > 100 ? 100 : totalPoints;

  return {
    date,
    score,
    points: dailyPoints,
    goalsCompleted,
    totalGoals: enabledGoals.length,
    streak: 0, // Will be calculated separately
    status,
    totalMinutesTracked: Math.round(totalMinutesTracked),
    activityBreakdown,
  };
}

/**
 * Calculate achievements for a week (7 days)
 */
export function calculateWeekAchievements(
  startDate: Date,
  sessionsByDate: Map<string, TrackingSession[]>,
  goals: ActivityGoal[],
  activities: Map<string, { name: string; color: string; isNegative?: boolean }>,
  dailyPointsMap?: Map<string, DailyPoints>
): DayAchievement[] {
  const achievements: DayAchievement[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);

    const achievement = calculateDayAchievement(dateStr, sessionsByDate, goals, activities, dailyPointsMap);
    achievements.push(achievement);
  }

  // Calculate streaks
  calculateStreaks(achievements);

  return achievements;
}

/**
 * Calculate current streak based on achievements
 */
function calculateStreaks(achievements: DayAchievement[]): void {
  let currentStreak = 0;

  // Iterate from most recent to oldest
  for (let i = achievements.length - 1; i >= 0; i--) {
    const achievement = achievements[i];

    if (achievement.status === 'excellent') {
      currentStreak += 1;
      achievement.streak = currentStreak;
    } else {
      // Streak broken
      for (let j = i; j >= 0; j--) {
        achievements[j].streak = 0;
      }
      break;
    }
  }
}

/**
 * Calculate overall streak from all sessions
 */
export function calculateOverallStreak(
  sessionsByDate: Map<string, TrackingSession[]>,
  goals: ActivityGoal[],
  activities: Map<string, { name: string; color: string; isNegative?: boolean }>,
  dailyPointsMap?: Map<string, DailyPoints>
): number {
  // Get last 90 days
  const today = new Date();
  const achievements: DayAchievement[] = [];

  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    const achievement = calculateDayAchievement(dateStr, sessionsByDate, goals, activities, dailyPointsMap);
    achievements.unshift(achievement); // Add to beginning
  }

  // Count streak from most recent day backwards
  let streak = 0;
  for (let i = achievements.length - 1; i >= 0; i--) {
    if (achievements[i].status === 'excellent') {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get date range for current week (Monday - Sunday)
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is 1

  const start = new Date(today);
  start.setDate(today.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get last N days from today
 */
export function getLastNDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    days.push(date);
  }

  return days;
}
