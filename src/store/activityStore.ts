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
  activeSession: ActiveSession | null;
  isLoading: boolean;

  // Actions
  loadActivities: () => Promise<void>;
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>;
  updateActivity: (id: string, updates: Partial<Activity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  reorderActivities: (activities: Activity[]) => Promise<void>;

  // Timer actions
  startTimer: (activityId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  loadActiveSession: () => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  // Initial state
  activities: [],
  activeSession: null,
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
      const { activities } = get();
      const activity = activities.find((a) => a.id === activityId);

      if (!activity) {
        throw new Error('Activity not found');
      }

      const newSession: ActiveSession = {
        activityId,
        activityName: activity.name,
        startTime: new Date().toISOString(),
        elapsedSeconds: 0,
      };

      await storage.saveActiveSession(newSession);
      set({ activeSession: newSession });
    } catch (error) {
      console.error('Failed to start timer:', error);
      throw error;
    }
  },

  // Stop timer and save session
  stopTimer: async () => {
    try {
      const { activeSession } = get();

      if (!activeSession) {
        return;
      }

      const endTime = new Date();
      const startTime = new Date(activeSession.startTime);
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      // Save completed session
      const trackingSession = {
        id: generateId(),
        activityId: activeSession.activityId,
        startTime: activeSession.startTime,
        endTime: endTime.toISOString(),
        durationSeconds,
        date: storage.formatDate(endTime),
        createdAt: new Date().toISOString(),
      };

      await storage.addTrackingSession(trackingSession);
      await storage.clearActiveSession();

      set({ activeSession: null });
    } catch (error) {
      console.error('Failed to stop timer:', error);
      throw error;
    }
  },

  // Load active session from storage (on app start)
  loadActiveSession: async () => {
    try {
      const activeSession = await storage.getActiveSession();
      set({ activeSession });
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
