/**
 * Activity Store
 * Manages activities and active tracking session using Zustand
 */

import { create } from 'zustand';
import { Activity, ActiveSession } from '../types';
import * as storage from '../services/storageService';

interface ActivityState {
  // State
  activities: Activity[];
  activeSessions: ActiveSession[]; // Changed from single session to array
  isLoading: boolean;

  // Actions
  loadActivities: () => Promise<void>;
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>;
  updateActivity: (id: string, updates: Partial<Activity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  reorderActivities: (activities: Activity[]) => Promise<void>;

  // Timer actions - updated for multi-session
  startTimer: (activityId: string) => Promise<void>;
  stopTimer: (activityId: string) => Promise<void>;
  pauseTimer: (activityId: string) => Promise<void>;
  resumeTimer: (activityId: string) => Promise<void>;
  cancelTimer: (activityId: string) => Promise<void>;
  toggleExpand: (activityId: string) => Promise<void>;
  loadActiveSessions: () => Promise<void>;

  // Legacy single-session support (deprecated)
  activeSession: ActiveSession | null;
  loadActiveSession: () => Promise<void>;
}

const MAX_CONCURRENT_SESSIONS = 3;

export const useActivityStore = create<ActivityState>((set, get) => ({
  // Initial state
  activities: [],
  activeSessions: [],
  activeSession: null, // Legacy - kept for backward compatibility
  isLoading: false,

  // Load activities from storage
  loadActivities: async () => {
    set({ isLoading: true });
    try {
      const activities = await storage.getActivities();
      set({ activities, isLoading: false });
    } catch (error) {
      console.error('Failed to load activities:', error);
      set({ isLoading: false });
    }
  },

  // Add new activity
  addActivity: async (activityData) => {
    try {
      const newActivity: Activity = {
        ...activityData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };

      await storage.addActivity(newActivity);

      // Reload from storage (source of truth)
      const activities = await storage.getActivities();
      set({ activities });
    } catch (error) {
      console.error('Failed to add activity:', error);
      throw error;
    }
  },

  // Update activity
  updateActivity: async (id, updates) => {
    try {
      await storage.updateActivity(id, updates);

      // Reload from storage
      const activities = await storage.getActivities();
      set({ activities });
    } catch (error) {
      console.error('Failed to update activity:', error);
      throw error;
    }
  },

  // Delete activity
  deleteActivity: async (id) => {
    try {
      await storage.deleteActivity(id);

      // Reload from storage
      const activities = await storage.getActivities();
      set({ activities });
    } catch (error) {
      console.error('Failed to delete activity:', error);
      throw error;
    }
  },

  // Reorder activities
  reorderActivities: async (reorderedActivities) => {
    try {
      // Update order property
      const activitiesWithNewOrder = reorderedActivities.map((activity, index) => ({
        ...activity,
        order: index,
      }));

      await storage.saveActivities(activitiesWithNewOrder);

      // Reload from storage
      const activities = await storage.getActivities();
      set({ activities });
    } catch (error) {
      console.error('Failed to reorder activities:', error);
      throw error;
    }
  },

  // Start timer for an activity
  startTimer: async (activityId) => {
    try {
      const { activities, activeSessions } = get();
      const activity = activities.find((a) => a.id === activityId);

      if (!activity) {
        throw new Error('Activity not found');
      }

      // Check if activity is already running
      if (activeSessions.some((s) => s.activityId === activityId)) {
        console.warn('Activity is already running');
        return;
      }

      // Check max concurrent sessions limit
      if (activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
        throw new Error(`Maximum ${MAX_CONCURRENT_SESSIONS} activities can run at the same time`);
      }

      const newSession: ActiveSession = {
        activityId,
        activityName: activity.name,
        startTime: new Date().toISOString(),
        elapsedSeconds: 0,
        isPaused: false,
        isExpanded: false, // Start in compact state
      };

      await storage.addActiveSession(newSession);
      const updatedSessions = await storage.getActiveSessions();
      set({
        activeSessions: updatedSessions,
        activeSession: updatedSessions[0] || null, // Legacy compatibility
      });
    } catch (error) {
      console.error('Failed to start timer:', error);
      throw error;
    }
  },

  // Stop timer and save session
  stopTimer: async (activityId) => {
    try {
      const { activeSessions } = get();
      const session = activeSessions.find((s) => s.activityId === activityId);

      if (!session) {
        console.warn('Session not found for activity:', activityId);
        return;
      }

      // Use elapsedSeconds from the active session (handles paused time correctly)
      // Ensure minimum 1 minute (60 seconds) is recorded
      const durationSeconds = Math.max(60, session.elapsedSeconds);

      // Save completed session
      const trackingSession = {
        id: generateId(),
        activityId: session.activityId,
        startTime: session.startTime,
        endTime: new Date().toISOString(),
        durationSeconds,
        date: storage.formatDate(new Date()),
        createdAt: new Date().toISOString(),
      };

      await storage.addTrackingSession(trackingSession);
      await storage.removeActiveSession(activityId);

      const updatedSessions = await storage.getActiveSessions();
      set({
        activeSessions: updatedSessions,
        activeSession: updatedSessions[0] || null, // Legacy compatibility
      });
    } catch (error) {
      console.error('Failed to stop timer:', error);
      throw error;
    }
  },

  // Pause timer
  pauseTimer: async (activityId) => {
    try {
      const { activeSessions } = get();
      const session = activeSessions.find((s) => s.activityId === activityId);

      if (!session || session.isPaused) {
        return;
      }

      await storage.updateActiveSession(activityId, {
        isPaused: true,
        pausedAt: new Date().toISOString(),
      });

      const updatedSessions = await storage.getActiveSessions();
      set({
        activeSessions: updatedSessions,
        activeSession: updatedSessions[0] || null, // Legacy compatibility
      });
    } catch (error) {
      console.error('Failed to pause timer:', error);
      throw error;
    }
  },

  // Resume timer
  resumeTimer: async (activityId) => {
    try {
      const { activeSessions } = get();
      const session = activeSessions.find((s) => s.activityId === activityId);

      if (!session || !session.isPaused) {
        return;
      }

      await storage.updateActiveSession(activityId, {
        isPaused: false,
        pausedAt: undefined,
      });

      const updatedSessions = await storage.getActiveSessions();
      set({
        activeSessions: updatedSessions,
        activeSession: updatedSessions[0] || null, // Legacy compatibility
      });
    } catch (error) {
      console.error('Failed to resume timer:', error);
      throw error;
    }
  },

  // Cancel timer without saving
  cancelTimer: async (activityId) => {
    try {
      await storage.removeActiveSession(activityId);

      const updatedSessions = await storage.getActiveSessions();
      set({
        activeSessions: updatedSessions,
        activeSession: updatedSessions[0] || null, // Legacy compatibility
      });
    } catch (error) {
      console.error('Failed to cancel timer:', error);
      throw error;
    }
  },

  // Toggle expanded state for an activity
  toggleExpand: async (activityId) => {
    try {
      const { activeSessions } = get();
      const session = activeSessions.find((s) => s.activityId === activityId);

      if (!session) {
        return;
      }

      await storage.updateActiveSession(activityId, {
        isExpanded: !session.isExpanded,
      });

      const updatedSessions = await storage.getActiveSessions();
      set({
        activeSessions: updatedSessions,
        activeSession: updatedSessions[0] || null, // Legacy compatibility
      });
    } catch (error) {
      console.error('Failed to toggle expand:', error);
      throw error;
    }
  },

  // Load active sessions from storage (on app start)
  loadActiveSessions: async () => {
    try {
      const activeSessions = await storage.getActiveSessions();
      set({
        activeSessions,
        activeSession: activeSessions[0] || null, // Legacy compatibility
      });
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    }
  },

  // Legacy single-session support (deprecated)
  loadActiveSession: async () => {
    try {
      // Redirect to new multi-session loader
      const activeSessions = await storage.getActiveSessions();
      set({
        activeSessions,
        activeSession: activeSessions[0] || null,
      });
    } catch (error) {
      console.error('Failed to load active session:', error);
    }
  },
}));

// Simple UUID generator
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
