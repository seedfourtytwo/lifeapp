/**
 * useActivityTimers Hook (Multi-Session)
 * Manages multiple active timers and updates elapsed time for each
 */

import { useState, useEffect, useCallback } from 'react';
import { useActivityStore } from '../store/activityStore';
import * as storage from '../services/storageService';
import { ActiveSession } from '../types';

export function useActivityTimers() {
  const {
    activeSessions,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    toggleExpand,
  } = useActivityStore();

  // Update elapsed time for all active sessions every second
  useEffect(() => {
    if (activeSessions.length === 0) {
      return;
    }

    const updateAllElapsed = async () => {
      const now = new Date();

      for (const session of activeSessions) {
        // Skip paused sessions
        if (session.isPaused) {
          continue;
        }

        const startTime = new Date(session.startTime);
        const totalElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

        // Update session in storage
        await storage.updateActiveSession(session.activityId, {
          elapsedSeconds: totalElapsed,
        });
      }

      // Refresh sessions from storage to get updated elapsedSeconds
      const updatedSessions = await storage.getActiveSessions();
      useActivityStore.setState({ activeSessions: updatedSessions });
    };

    // Update immediately
    updateAllElapsed();

    // Then update every second
    const interval = setInterval(updateAllElapsed, 1000);

    // Cleanup on unmount or when activeSessions changes
    return () => clearInterval(interval);
  }, [activeSessions.length, activeSessions.map(s => `${s.activityId}-${s.isPaused}`).join(',')]);

  // Helper to get session for a specific activity
  const getSessionForActivity = useCallback((activityId: string): ActiveSession | undefined => {
    return activeSessions.find(s => s.activityId === activityId);
  }, [activeSessions]);

  // Helper to check if an activity is running
  const isActivityRunning = useCallback((activityId: string): boolean => {
    return activeSessions.some(s => s.activityId === activityId);
  }, [activeSessions]);

  return {
    activeSessions,
    getSessionForActivity,
    isActivityRunning,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    toggleExpand,
  };
}

/**
 * Format seconds into HH:MM:SS (for active timer with seconds)
 */
export function formatTimeWithSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format seconds into HH:MM (hours and minutes only, for stats/history)
 */
export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
