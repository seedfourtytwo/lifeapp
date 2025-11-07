/**
 * Core data types for the Life Tracking App
 * All data is stored locally using AsyncStorage
 */

/**
 * Activity types for specialized functionality
 */
export type ActivityType = 'standard' | 'meditation' | 'cooking' | 'workout' | 'sleep' | 'reading';

/**
 * Activity features configuration
 */
export interface ActivityFeatures {
  hasTimerPresets?: boolean; // Quick duration buttons (5min, 15min, 30min)
  hasMusic?: boolean; // Music/sound selection
  hasRecipes?: boolean; // Recipe library and display
  hasInstructions?: boolean; // Step-by-step instructions
  hasRoutines?: boolean; // Workout/exercise routines
  // Extensible for future features
}

/**
 * Activity - represents a trackable activity (meditation, cooking, workout, etc.)
 */
export interface Activity {
  id: string; // UUID
  name: string; // e.g., "Meditation", "Cooking"
  color: string; // Hex color code, e.g., "#4CAF50"
  icon: string; // Icon name (from icon library or emoji)
  points?: number; // DEPRECATED: Use goalPoints instead
  createdAt: string; // ISO 8601 timestamp
  order: number; // For custom ordering in the UI
  isNegative?: boolean; // True for activities that subtract from score (procrastination, social media, etc.)

  // NEW FIELDS - Activity System Enhancement
  activityType?: ActivityType; // Type of activity for specialized features
  isBuiltIn?: boolean; // Built-in activities can't be deleted
  features?: ActivityFeatures; // Feature configuration

  // Point System Fields
  goalPoints?: number; // Points awarded when daily goal is met (default: 10)
  negativePointsPerMinute?: number; // Points deducted per minute for negative activities (default: 0.5)
}

/**
 * TrackingSession - represents a completed or ongoing tracking session
 */
export interface TrackingSession {
  id: string; // UUID
  activityId: string; // Reference to Activity.id
  startTime: string; // ISO 8601 timestamp
  endTime?: string; // ISO 8601 timestamp (undefined if still in progress)
  durationSeconds: number; // Total duration in seconds
  date: string; // Date in YYYY-MM-DD format for easy daily queries
  createdAt: string; // ISO 8601 timestamp
}

/**
 * ActiveSession - represents a currently running timer
 * Multiple sessions can run concurrently (up to 3)
 */
export interface ActiveSession {
  activityId: string;
  activityName: string;
  startTime: string; // ISO 8601 timestamp
  elapsedSeconds: number; // Updated periodically
  isPaused: boolean; // Whether the timer is currently paused
  pausedAt?: string; // ISO 8601 timestamp when paused
  isExpanded: boolean; // Whether the activity card is showing expanded view
}

/**
 * DailyStats - aggregated statistics for a single day
 */
export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
  activityBreakdown: ActivityStats[];
}

/**
 * ActivityStats - time spent on a specific activity
 */
export interface ActivityStats {
  activityId: string;
  activityName: string;
  activityColor: string;
  totalSeconds: number;
  sessionCount: number;
  percentage: number; // Percentage of total time for the day
}

/**
 * ActivityGoal - goal requirement for a specific activity
 */
export interface ActivityGoal {
  activityId: string;
  activityName: string;
  minimumMinutes: number;
  enabled: boolean;
}

/**
 * PointBreakdown - individual point contribution
 */
export interface PointBreakdown {
  source: 'activity' | 'todo'; // Source type
  sourceId: string; // activityId or todoId
  sourceName: string; // Activity or todo name
  points: number; // Positive or negative points
  goalMet: boolean; // For activities: reached 100% of goal?
  timeSpent?: number; // For activities: seconds tracked
  goalTime?: number; // For activities: goal seconds
}

/**
 * DailyPoints - daily point calculation and bonus tracking
 */
export interface DailyPoints {
  date: string; // YYYY-MM-DD
  earnedPoints: number; // Points earned from activities + todos (can be negative)
  bonusApplied: number; // Manual bonus points applied to reach 100
  totalPoints: number; // earnedPoints + bonusApplied
  reachedGoal: boolean; // true if totalPoints >= 100
  breakdown: PointBreakdown[]; // Detailed breakdown
}

/**
 * WeeklyBonus - weekly bonus point tracking
 */
export interface WeeklyBonus {
  weekStart: string; // YYYY-MM-DD of Monday
  availableBonus: number; // Accumulated bonus points this week
  usedBonus: number; // Total bonus used this week
  dailyBreakdown: { date: string; earned: number; used: number }[]; // Daily details
}

/**
 * StreakData - streak tracking
 */
export interface StreakData {
  currentStreak: number; // Days in a row reaching 100+ points
  longestStreak: number; // Historical longest streak
  lastUpdateDate: string; // YYYY-MM-DD to detect breaks
}

/**
 * DayAchievement - calculated achievement status for a day
 */
export interface DayAchievement {
  date: string; // YYYY-MM-DD
  score: number; // DEPRECATED: 0-100 percentage (kept for backward compatibility)
  points?: DailyPoints; // NEW: Full point breakdown
  goalsCompleted: number;
  totalGoals: number;
  streak: number;
  status: 'excellent' | 'good' | 'poor'; // Green/Yellow/Red (based on points: 100+ = excellent, 80-99 = good, <80 = poor)
  totalMinutesTracked: number;
  activityBreakdown: ActivityStats[];
}

/**
 * UserSettings - app settings and preferences
 */
export interface UserSettings {
  notificationsEnabled: boolean;
  reminderTimes: ReminderTime[];
  theme: 'light' | 'dark' | 'auto';
  dailyGoals: ActivityGoal[]; // Daily activity goals
}

/**
 * ReminderTime - scheduled reminder configuration
 */
export interface ReminderTime {
  id: string;
  activityId?: string; // Optional: remind for specific activity
  time: string; // HH:mm format, e.g., "20:00"
  message: string; // e.g., "Time to meditate!"
  enabled: boolean;
}

/**
 * Todo - represents a todo item
 */
export interface Todo {
  id: string; // UUID
  title: string; // One-liner description
  completed: boolean; // Whether the task is completed
  createdAt: string; // ISO 8601 timestamp
  completedAt?: string; // ISO 8601 timestamp when completed
  deadline?: string; // Optional deadline in YYYY-MM-DD format
  points: number; // Points to award when completed (default: 5)
}

/**
 * Recipe ingredient item
 */
export interface RecipeIngredient {
  item: string; // Ingredient name (e.g., "Flour", "Eggs")
  quantity: number; // Amount
  unit: string; // Unit of measurement (e.g., "g", "ml", "cup", "tsp", "tbsp")
}

/**
 * Recipe - cooking recipe with ingredients and instructions
 */
export interface Recipe {
  id: string; // UUID
  name: string; // Recipe name
  servings: number; // Number of servings
  ingredients: RecipeIngredient[]; // List of ingredients
  instructions: string; // Cooking instructions (simple text/notes)
  createdAt: string; // ISO 8601 timestamp
  activityId?: string; // Optional: link to specific activity
}

/**
 * Storage keys for AsyncStorage
 */
export const STORAGE_KEYS = {
  ACTIVITIES: '@lifeapp:activities',
  TRACKING_SESSIONS: '@lifeapp:sessions',
  ACTIVE_SESSION: '@lifeapp:active_session', // Legacy single session (for migration)
  ACTIVE_SESSIONS: '@lifeapp:active_sessions', // New multiple sessions
  USER_SETTINGS: '@lifeapp:settings',
  TODOS: '@lifeapp:todos',
  RECIPES: '@lifeapp:recipes',
  DAILY_POINTS: '@lifeapp:daily_points', // Daily point calculations
  WEEKLY_BONUS: '@lifeapp:weekly_bonus', // Weekly bonus tracking
  STREAK_DATA: '@lifeapp:streak_data', // Streak information
} as const;

/**
 * Default activities to seed the app on first launch
 */
export const DEFAULT_ACTIVITIES: Omit<Activity, 'id' | 'createdAt'>[] = [
  { name: 'Sleep', color: '#3F51B5', icon: 'sleep', points: 10, order: 0, isNegative: false },
  { name: 'Read', color: '#2196F3', icon: 'book-open-variant', points: 10, order: 1, isNegative: false },
  { name: 'Workout', color: '#F44336', icon: 'dumbbell', points: 15, order: 2, isNegative: false },
  { name: 'Study', color: '#00BCD4', icon: 'school', points: 10, order: 3, isNegative: false },
  { name: 'Work', color: '#9C27B0', icon: 'briefcase', points: 5, order: 4, isNegative: false },
  { name: 'Meditate', color: '#4CAF50', icon: 'meditation', points: 10, order: 5, isNegative: false },
  { name: 'Fasting', color: '#FF9800', icon: 'silverware-fork-knife', points: 5, order: 6, isNegative: false },
  { name: 'House Chores', color: '#795548', icon: 'broom', points: 5, order: 7, isNegative: false },
  { name: 'Social Media', color: '#FF5252', icon: 'cellphone', points: 0, order: 8, isNegative: true },
  { name: 'Other', color: '#607D8B', icon: 'dots-horizontal', points: 5, order: 9, isNegative: false },
];
