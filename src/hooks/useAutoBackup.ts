import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { runDailyBackup } from '../backup/dailyBackup';
import { whenStartupDone } from './startupGate';

/**
 * Today's backup, once the app has finished starting and again each time it
 * comes to the front; the runner itself skips targets already done today.
 * Android only: the one target there is today is a folder on the phone.
 */
export function useAutoBackup(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    let mounted = true;
    void whenStartupDone().then(() => {
      if (mounted) void runDailyBackup();
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runDailyBackup();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
}
