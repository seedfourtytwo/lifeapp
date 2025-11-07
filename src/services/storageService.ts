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
  Todo,
  Recipe,
  DailyPoints,
  WeeklyBonus,
  StreakData,
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
  const activities: Activity[] = DEFAULT_ACTIVITIES.map((activity, _index) => ({
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
 * Active Sessions (Multiple) - New multi-session support
 */

export const getActiveSessions = async (): Promise<ActiveSession[]> => {
  try {
    // Try to get new multi-session format first
    const json = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSIONS);
    if (json) {
      return JSON.parse(json);
    }

    // Migration: check if there's a legacy single session
    const legacySession = await getActiveSession();
    if (legacySession) {
      // Migrate to new format
      const sessions = [{ ...legacySession, isExpanded: false }];
      await saveActiveSessions(sessions);
      await clearActiveSession(); // Remove legacy session
      return sessions;
    }

    return [];
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
};

export const saveActiveSessions = async (sessions: ActiveSession[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving active sessions:', error);
    throw error;
  }
};

export const addActiveSession = async (session: ActiveSession): Promise<void> => {
  const sessions = await getActiveSessions();
  sessions.push(session);
  await saveActiveSessions(sessions);
};

export const updateActiveSession = async (activityId: string, updates: Partial<ActiveSession>): Promise<void> => {
  const sessions = await getActiveSessions();
  const index = sessions.findIndex((s) => s.activityId === activityId);
  if (index !== -1) {
    sessions[index] = { ...sessions[index], ...updates };
    await saveActiveSessions(sessions);
  }
};

export const removeActiveSession = async (activityId: string): Promise<void> => {
  const sessions = await getActiveSessions();
  const filtered = sessions.filter((s) => s.activityId !== activityId);
  await saveActiveSessions(filtered);
};

export const clearActiveSessions = async (): Promise<void> => {
  await saveActiveSessions([]);
};

/**
 * Todos
 */

export const getTodos = async (): Promise<Todo[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.TODOS);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Error getting todos:', error);
    return [];
  }
};

export const saveTodos = async (todos: Todo[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
  } catch (error) {
    console.error('Error saving todos:', error);
    throw error;
  }
};

export const addTodo = async (todo: Todo): Promise<void> => {
  const todos = await getTodos();
  todos.push(todo);
  await saveTodos(todos);
};

export const updateTodo = async (todoId: string, updates: Partial<Todo>): Promise<void> => {
  const todos = await getTodos();
  const index = todos.findIndex((t) => t.id === todoId);
  if (index !== -1) {
    todos[index] = { ...todos[index], ...updates };
    await saveTodos(todos);
  }
};

export const deleteTodo = async (todoId: string): Promise<void> => {
  const todos = await getTodos();
  const filtered = todos.filter((t) => t.id !== todoId);
  await saveTodos(filtered);
};

export const getActiveTodos = async (): Promise<Todo[]> => {
  const todos = await getTodos();
  return todos.filter((t) => !t.completed);
};

export const getCompletedTodos = async (daysBack: number = 30): Promise<Todo[]> => {
  const todos = await getTodos();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffISO = cutoffDate.toISOString();

  return todos.filter((t) => t.completed && t.completedAt && t.completedAt >= cutoffISO);
};

/**
 * Recipes
 */

export const getRecipes = async (): Promise<Recipe[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.RECIPES);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Error getting recipes:', error);
    return [];
  }
};

export const saveRecipes = async (recipes: Recipe[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(recipes));
  } catch (error) {
    console.error('Error saving recipes:', error);
    throw error;
  }
};

export const addRecipe = async (recipe: Recipe): Promise<void> => {
  const recipes = await getRecipes();
  recipes.push(recipe);
  await saveRecipes(recipes);
};

export const updateRecipe = async (recipeId: string, updates: Partial<Recipe>): Promise<void> => {
  const recipes = await getRecipes();
  const index = recipes.findIndex((r) => r.id === recipeId);
  if (index !== -1) {
    recipes[index] = { ...recipes[index], ...updates };
    await saveRecipes(recipes);
  }
};

export const deleteRecipe = async (recipeId: string): Promise<void> => {
  const recipes = await getRecipes();
  const filtered = recipes.filter((r) => r.id !== recipeId);
  await saveRecipes(filtered);
};

export const getRecipesByActivity = async (activityId: string): Promise<Recipe[]> => {
  const recipes = await getRecipes();
  return recipes.filter((r) => r.activityId === activityId);
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
export const generateId = (): string => {
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
      STORAGE_KEYS.ACTIVE_SESSIONS,
      STORAGE_KEYS.USER_SETTINGS,
      STORAGE_KEYS.TODOS,
      STORAGE_KEYS.RECIPES,
    ]);
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
};

/**
 * Daily Points
 */

export const getDailyPoints = async (date: string): Promise<DailyPoints | null> => {
  try {
    const json = await AsyncStorage.getItem(`${STORAGE_KEYS.DAILY_POINTS}:${date}`);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Error getting daily points:', error);
    return null;
  }
};

export const saveDailyPoints = async (dailyPoints: DailyPoints): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.DAILY_POINTS}:${dailyPoints.date}`,
      JSON.stringify(dailyPoints)
    );
  } catch (error) {
    console.error('Error saving daily points:', error);
    throw error;
  }
};

export const getDailyPointsRange = async (startDate: string, endDate: string): Promise<DailyPoints[]> => {
  try {
    // Get all keys matching the daily points pattern
    const allKeys = await AsyncStorage.getAllKeys();
    const pointsKeys = allKeys.filter((key) => key.startsWith(STORAGE_KEYS.DAILY_POINTS));

    // Filter keys within date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const relevantKeys = pointsKeys.filter((key) => {
      const date = key.split(':')[1];
      const keyDate = new Date(date);
      return keyDate >= start && keyDate <= end;
    });

    // Fetch all relevant points
    const points = await Promise.all(
      relevantKeys.map(async (key) => {
        const json = await AsyncStorage.getItem(key);
        return json ? JSON.parse(json) : null;
      })
    );

    return points.filter((p) => p !== null).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting daily points range:', error);
    return [];
  }
};

/**
 * Weekly Bonus
 */

export const getCurrentWeeklyBonus = async (): Promise<WeeklyBonus> => {
  try {
    // Get Monday of current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Get to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const weekStart = monday.toISOString().split('T')[0];

    const json = await AsyncStorage.getItem(`${STORAGE_KEYS.WEEKLY_BONUS}:${weekStart}`);
    if (json) {
      return JSON.parse(json);
    }

    // Initialize new week
    const newWeeklyBonus: WeeklyBonus = {
      weekStart,
      availableBonus: 0,
      usedBonus: 0,
      dailyBreakdown: [],
    };
    await saveWeeklyBonus(newWeeklyBonus);
    return newWeeklyBonus;
  } catch (error) {
    console.error('Error getting current weekly bonus:', error);
    // Return default
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return {
      weekStart: monday.toISOString().split('T')[0],
      availableBonus: 0,
      usedBonus: 0,
      dailyBreakdown: [],
    };
  }
};

export const saveWeeklyBonus = async (weeklyBonus: WeeklyBonus): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.WEEKLY_BONUS}:${weeklyBonus.weekStart}`,
      JSON.stringify(weeklyBonus)
    );
  } catch (error) {
    console.error('Error saving weekly bonus:', error);
    throw error;
  }
};

export const resetWeeklyBonus = async (): Promise<void> => {
  // Called at the start of a new week
  // The getCurrentWeeklyBonus function will automatically create a new week entry
  // Old weeks are kept in storage for historical purposes
};

/**
 * Streak Data
 */

export const getStreakData = async (): Promise<StreakData> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.STREAK_DATA);
    if (json) {
      return JSON.parse(json);
    }
    // Initialize
    const initialStreak: StreakData = {
      currentStreak: 0,
      longestStreak: 0,
      lastUpdateDate: new Date().toISOString().split('T')[0],
    };
    await saveStreakData(initialStreak);
    return initialStreak;
  } catch (error) {
    console.error('Error getting streak data:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastUpdateDate: new Date().toISOString().split('T')[0],
    };
  }
};

export const saveStreakData = async (streakData: StreakData): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(streakData));
  } catch (error) {
    console.error('Error saving streak data:', error);
    throw error;
  }
};

/**
 * Export all data (for backup)
 */
export const exportAllData = async (): Promise<string> => {
  const [activities, sessions, activeSessions, settings, todos, recipes] = await Promise.all([
    getActivities(),
    getTrackingSessions(),
    getActiveSessions(),
    getUserSettings(),
    getTodos(),
    getRecipes(),
  ]);

  return JSON.stringify(
    {
      activities,
      sessions,
      activeSessions, // New multi-session format
      settings,
      todos,
      recipes,
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
      saveActiveSessions(data.activeSessions || []),
      saveUserSettings(data.settings || DEFAULT_SETTINGS),
      saveTodos(data.todos || []),
      saveRecipes(data.recipes || []),
    ]);
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
};
