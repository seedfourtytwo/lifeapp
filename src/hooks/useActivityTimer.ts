/**
 * useActivityTimer Hook
 * Manages the active timer and updates elapsed time every second
 */

import { useState, useEffect } from 'react';
import { useActivityStore } from '../store/activityStore';
import * as storage from '../services/storageService';

export function useActivityTimer() {
  const {
    activeSession,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer
  } = useActivityStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Update elapsed time every second when there's an active session and not paused
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    // Initialize from stored elapsedSeconds
    setElapsedSeconds(activeSession.elapsedSeconds);

    // Don't run interval if paused
    if (activeSession.isPaused) {
      return;
    }

    // Calculate elapsed time, accounting for pause
    const startTime = new Date(activeSession.startTime);

    const updateElapsed = async () => {
      const now = new Date();
      const totalElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

      // Update local state
      setElapsedSeconds(totalElapsed);

      // Persist to storage every second so it survives app restart
      const updatedSession = {
        ...activeSession,
        elapsedSeconds: totalElapsed,
      };
      await storage.saveActiveSession(updatedSession);
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const interval = setInterval(updateElapsed, 1000);

    // Cleanup on unmount or when activeSession changes
    return () => clearInterval(interval);
  }, [activeSession, activeSession?.isPaused]);

  return {
    activeSession,
    elapsedSeconds,
    isRunning: activeSession !== null,
    isPaused: activeSession?.isPaused || false,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
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
