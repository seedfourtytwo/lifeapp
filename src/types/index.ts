/**
 * Core data types for the Life Tracking App
 * All data is stored locally using AsyncStorage
 */

/**
 * Activity - represents a trackable activity (meditation, cooking, workout, etc.)
 */
export interface Activity {
  id: string; // UUID
  name: string; // e.g., "Meditation", "Cooking"
  color: string; // Hex color code, e.g., "#4CAF50"
  icon: string; // Icon name (from icon library or emoji)
  points?: number; // Optional points for gamification (future feature)
  createdAt: string; // ISO 8601 timestamp
  order: number; // For custom ordering in the UI
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
 * ActiveSession - represents the currently running timer
 * Only one active session can exist at a time
 */
export interface ActiveSession {
  activityId: string;
  activityName: string;
  startTime: string; // ISO 8601 timestamp
  elapsedSeconds: number; // Updated periodically
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
 * UserSettings - app settings and preferences
 */
export interface UserSettings {
  notificationsEnabled: boolean;
  reminderTimes: ReminderTime[];
  theme: 'light' | 'dark' | 'auto';
  dailyGoalSeconds?: number; // Optional daily time goal
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
 * Storage keys for AsyncStorage
 */
export const STORAGE_KEYS = {
  ACTIVITIES: '@lifeapp:activities',
  TRACKING_SESSIONS: '@lifeapp:sessions',
  ACTIVE_SESSION: '@lifeapp:active_session',
  USER_SETTINGS: '@lifeapp:settings',
} as const;

/**
 * Default activities to seed the app on first launch
 */
export const DEFAULT_ACTIVITIES: Omit<Activity, 'id' | 'createdAt'>[] = [
  { name: 'Meditation', color: '#4CAF50', icon: 'meditation', points: 10, order: 0 },
  { name: 'Cooking', color: '#FF9800', icon: 'chef-hat', points: 5, order: 1 },
  { name: 'Workout', color: '#F44336', icon: 'dumbbell', points: 15, order: 2 },
  { name: 'Reading', color: '#2196F3', icon: 'book-open-variant', points: 10, order: 3 },
  { name: 'Work', color: '#9C27B0', icon: 'briefcase', points: 5, order: 4 },
  { name: 'Learning', color: '#00BCD4', icon: 'school', points: 10, order: 5 },
];
