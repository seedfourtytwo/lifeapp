/**
 * Storage Service
 * Handles all local data persistence using AsyncStorage
 * All data is stored as JSON strings
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Activity,
  TrackingSession,
  ActiveSession,
  UserSettings,
  STORAGE_KEYS,
  DEFAULT_ACTIVITIES,
} from '../types';

/**
 * Activities
 */

export const getActivities = async (): Promise<Activity[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    if (json) {
      return JSON.parse(json);
    }
    // First time: initialize with default activities
    await initializeDefaultActivities();
    return getActivities();
  } catch (error) {
    console.error('Error getting activities:', error);
    return [];
  }
};

export const saveActivities = async (activities: Activity[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
  } catch (error) {
    console.error('Error saving activities:', error);
    throw error;
  }
};

export const addActivity = async (activity: Activity): Promise<void> => {
  const activities = await getActivities();
  activities.push(activity);
  await saveActivities(activities);
};

export const updateActivity = async (activityId: string, updates: Partial<Activity>): Promise<void> => {
  const activities = await getActivities();
  const index = activities.findIndex((a) => a.id === activityId);
  if (index !== -1) {
    activities[index] = { ...activities[index], ...updates };
    await saveActivities(activities);
  }
};

export const deleteActivity = async (activityId: string): Promise<void> => {
  const activities = await getActivities();
  const filtered = activities.filter((a) => a.id !== activityId);
  await saveActivities(filtered);
};

const initializeDefaultActivities = async (): Promise<void> => {
  const activities: Activity[] = DEFAULT_ACTIVITIES.map((activity, index) => ({
    ...activity,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }));
  await saveActivities(activities);
};

/**
 * Tracking Sessions
 */

export const getTrackingSessions = async (): Promise<TrackingSession[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_SESSIONS);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Error getting tracking sessions:', error);
    return [];
  }
};

export const saveTrackingSessions = async (sessions: TrackingSession[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKING_SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving tracking sessions:', error);
    throw error;
  }
};

export const addTrackingSession = async (session: TrackingSession): Promise<void> => {
  const sessions = await getTrackingSessions();
  sessions.push(session);
  await saveTrackingSessions(sessions);
};

export const updateTrackingSession = async (sessionId: string, updates: Partial<TrackingSession>): Promise<void> => {
  const sessions = await getTrackingSessions();
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index !== -1) {
    sessions[index] = { ...sessions[index], ...updates };
    await saveTrackingSessions(sessions);
  }
};

export const deleteTrackingSession = async (sessionId: string): Promise<void> => {
  const sessions = await getTrackingSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  await saveTrackingSessions(filtered);
};

export const getSessionsByDate = async (date: string): Promise<TrackingSession[]> => {
  const sessions = await getTrackingSessions();
  return sessions.filter((s) => s.date === date);
};

export const getSessionsByDateRange = async (startDate: string, endDate: string): Promise<TrackingSession[]> => {
  const sessions = await getTrackingSessions();
  return sessions.filter((s) => s.date >= startDate && s.date <= endDate);
};

/**
 * Active Session
 */

export const getActiveSession = async (): Promise<ActiveSession | null> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Error getting active session:', error);
    return null;
  }
};

export const saveActiveSession = async (session: ActiveSession | null): Promise<void> => {
  try {
    if (session) {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  } catch (error) {
    console.error('Error saving active session:', error);
    throw error;
  }
};

export const clearActiveSession = async (): Promise<void> => {
  await saveActiveSession(null);
};

/**
 * User Settings
 */

const DEFAULT_SETTINGS: UserSettings = {
  notificationsEnabled: true,
  reminderTimes: [],
  theme: 'auto',
  dailyGoals: [],
};

export const getUserSettings = async (): Promise<UserSettings> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    return json ? JSON.parse(json) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error getting user settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveUserSettings = async (settings: UserSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

/**
 * Utility functions
 */

// Simple UUID generator (for offline use)
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Format date to YYYY-MM-DD
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Clear all data (for testing/debugging)
 */
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACTIVITIES,
      STORAGE_KEYS.TRACKING_SESSIONS,
      STORAGE_KEYS.ACTIVE_SESSION,
      STORAGE_KEYS.USER_SETTINGS,
    ]);
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
};

/**
 * Export all data (for backup)
 */
export const exportAllData = async (): Promise<string> => {
  const [activities, sessions, activeSession, settings] = await Promise.all([
    getActivities(),
    getTrackingSessions(),
    getActiveSession(),
    getUserSettings(),
  ]);

  return JSON.stringify(
    {
      activities,
      sessions,
      activeSession,
      settings,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
};

/**
 * Import data (from backup)
 */
export const importAllData = async (jsonData: string): Promise<void> => {
  try {
    const data = JSON.parse(jsonData);
    await Promise.all([
      saveActivities(data.activities || []),
      saveTrackingSessions(data.sessions || []),
      saveActiveSession(data.activeSession || null),
      saveUserSettings(data.settings || DEFAULT_SETTINGS),
    ]);
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
};
