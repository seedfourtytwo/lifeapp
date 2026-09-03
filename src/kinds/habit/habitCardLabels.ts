import { i18n } from '../../i18n';
import {
  getHabitTimerPlaybackMode,
  hasHabitTimerSound,
  shouldShowHabitStreakOnCard,
  type HabitConfig,
  type HabitTimerPlaybackMode,
} from '../../protocol';

/**
 * Success-streak day count for compact Home card display.
 * Independent of whether today is complete — a run through yesterday still shows
 * so the streak motivates check-off.
 */
export function getHabitStreakDays(
  config: HabitConfig,
  streak?: number,
): number | null {
  if (!shouldShowHabitStreakOnCard(config)) return null;
  const days = streak ?? 0;
  if (days <= 0) return null;
  return days;
}

/**
 * Success-streak copy for accessibility (and any non-compact surfaces).
 */
export function formatHabitStreakLabel(
  config: HabitConfig,
  streak?: number,
): string | null {
  const days = getHabitStreakDays(config, streak);
  if (days == null) return null;
  return days === 1
    ? i18n.t('trackers:habitWidget.streakOne')
    : i18n.t('trackers:habitWidget.streakMany', { count: days });
}

/**
 * Which sound glyph the Home card shows, and what it says out loud.
 *
 * `repeat` is the media-player convention for "this keeps going"; `music-note`
 * is one track, played through. There is no third state: a habit with no sound
 * shows nothing rather than an "off" glyph, because most habits have no sound
 * and a row of crossed-out notes would be noise.
 *
 * Loudness is absent on purpose — nothing in the app sets a per-tracker volume,
 * so there is no level to report.
 */
export type HabitCardSoundIndicator = {
  mode: HabitTimerPlaybackMode;
  /** MaterialCommunityIcons glyph name. */
  icon: 'repeat' | 'music-note';
  accessibilityLabel: string;
};

/**
 * Sound badge for a Home habit card, or `null` when the card must stay silent.
 *
 * Only timer habits ever play audio, so a boolean habit is silent even when its
 * config still carries a `timerSound` from before the mode was switched — the
 * same stance `isHabitDayComplete` and `getHabitTimerEffectiveTargetSeconds`
 * already take. A track id missing from the bundled catalog counts as no sound.
 */
export function describeHabitCardSound(
  config: HabitConfig,
): HabitCardSoundIndicator | null {
  if (config.trackingMode !== 'timer') return null;
  if (!hasHabitTimerSound(config.timerSound)) return null;

  const mode = getHabitTimerPlaybackMode(config.timerSound);
  return mode === 'loop'
    ? {
        mode,
        icon: 'repeat',
        accessibilityLabel: i18n.t('trackers:habitWidget.soundLoopsA11y'),
      }
    : {
        mode,
        icon: 'music-note',
        accessibilityLabel: i18n.t('trackers:habitWidget.soundPlaysOnceA11y'),
      };
}

/** Optional schedule / target blurb (History / details — not Home one-liners). */
export function formatHabitCardDescription(description: string | undefined): string | null {
  const desc = description?.trim();
  return desc ? desc : null;
}
