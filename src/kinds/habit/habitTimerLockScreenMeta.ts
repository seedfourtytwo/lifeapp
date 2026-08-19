import { i18n } from '../i18n';
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
  const stateLabel = isActiveTimerPaused(session)
    ? i18n.t('trackers:lockScreen.paused')
    : i18n.t('trackers:lockScreen.running');

  return {
    title: habitName,
    artist: i18n.t('common:appName'),
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
    config.trackingMode === 'timer'
      ? i18n.t('trackers:lockScreen.playToStart')
      : i18n.t('trackers:lockScreen.playToCheckOff');
  const ready = i18n.t('trackers:lockScreen.ready');
  return {
    title: habitName,
    artist: i18n.t('common:appName'),
    albumTitle: positionLabel ? `${ready} · ${action} · ${positionLabel}` : `${ready} · ${action}`,
  };
}
