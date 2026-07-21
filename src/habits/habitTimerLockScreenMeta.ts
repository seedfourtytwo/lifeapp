import {
  activeTimerElapsedSeconds,
  formatHabitTimerDuration,
  isActiveTimerPaused,
  type ActiveTimerSession,
  type HabitConfig,
} from '../protocol';

export type HabitTimerLockScreenMeta = {
  title?: string;
  artist?: string;
  albumTitle?: string;
  artworkUrl?: string;
};

/** Build lock-screen / Now Playing metadata for an active habit timer. */
export function buildHabitTimerLockScreenMeta(
  habitName: string,
  session: ActiveTimerSession,
  config: HabitConfig,
  nowMs = Date.now(),
): HabitTimerLockScreenMeta {
  const elapsed = activeTimerElapsedSeconds(session, nowMs);
  const target = config.dailyTargetSeconds;
  const timeLabel =
    target !== undefined && target > 0
      ? `${formatHabitTimerDuration(elapsed)} / ${formatHabitTimerDuration(target)}`
      : formatHabitTimerDuration(elapsed);
  const stateLabel = isActiveTimerPaused(session) ? 'Paused' : 'Running';

  return {
    title: habitName,
    artist: 'Life Dashboard',
    albumTitle: `${stateLabel} · ${timeLabel}`,
  };
}

/** Metadata when a habit is focused on the lock screen but not timing yet. */
export function buildHabitReadyLockScreenMeta(
  habitName: string,
  config: HabitConfig,
  positionLabel?: string,
): HabitTimerLockScreenMeta {
  const action =
    config.trackingMode === 'timer' ? 'Play to start' : 'Play to check off';
  return {
    title: habitName,
    artist: 'Life Dashboard',
    albumTitle: positionLabel ? `Ready · ${action} · ${positionLabel}` : `Ready · ${action}`,
  };
}
