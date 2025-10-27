/**
 * useActivityTimer Hook
 * Manages the active timer and updates elapsed time every second
 */

import { useState, useEffect } from 'react';
import { useActivityStore } from '../store/activityStore';

export function useActivityTimer() {
  const { activeSession, startTimer, stopTimer } = useActivityStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Update elapsed time every second when there's an active session
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    // Calculate initial elapsed time
    const startTime = new Date(activeSession.startTime);
    const updateElapsed = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedSeconds(elapsed);
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const interval = setInterval(updateElapsed, 1000);

    // Cleanup on unmount or when activeSession changes
    return () => clearInterval(interval);
  }, [activeSession]);

  return {
    activeSession,
    elapsedSeconds,
    isRunning: activeSession !== null,
    startTimer,
    stopTimer,
  };
}

/**
 * Format seconds into HH:MM:SS
 */
export function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
