import { updateHabitTimerLockScreen } from '../../audio/habitTimerSound';
import {
  buildHabitReadyLockScreenMeta,
  buildHabitTimerLockScreenMeta,
  type HabitTimerLockScreenMeta,
} from './habitTimerLockScreenMeta';

export {
  buildHabitReadyLockScreenMeta,
  buildHabitTimerLockScreenMeta,
  type HabitTimerLockScreenMeta,
};

let metadataTicker: ReturnType<typeof setInterval> | null = null;

export function stopHabitTimerLockScreenTicker(): void {
  if (metadataTicker) {
    clearInterval(metadataTicker);
    metadataTicker = null;
  }
}

/** Refresh lock-screen subtitle with live elapsed time while a timer runs. */
export function startHabitTimerLockScreenTicker(
  getMeta: () => HabitTimerLockScreenMeta | null,
): void {
  stopHabitTimerLockScreenTicker();
  const tick = () => {
    const meta = getMeta();
    if (!meta) {
      stopHabitTimerLockScreenTicker();
      return;
    }
    updateHabitTimerLockScreen(meta);
  };
  tick();
  metadataTicker = setInterval(tick, 1000);
}
