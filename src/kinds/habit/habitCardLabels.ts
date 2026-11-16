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
 * A `times_per_week` habit's streak is counted in weeks and says so.
 */
export function formatHabitStreakLabel(
  config: HabitConfig,
  streak?: number,
): string | null {
  const count = getHabitStreakDays(config, streak);
  if (count == null) return null;
  if (config.schedule.type === 'times_per_week') {
    return i18n.t('trackers:habitWidget.streakWeeks', { count });
  }
  return count === 1
    ? i18n.t('trackers:habitWidget.streakOne')
    : i18n.t('trackers:habitWidget.streakMany', { count });
}

/**
 * The one line under a Home row's name. `figure` (when set) is a quantity the
 * row draws in the mono face after `text`; `a11y` is what a screen reader says.
 */
export interface TrackerCardCaption {
  text: string;
  figure?: string;
  a11y: string;
}

/** "Strength 62": the score in the caption slot once the run has broken. */
export function strengthCaption(
  score: number,
  ns: 'habitWidget' | 'counterWidget',
): TrackerCardCaption {
  return {
    text: i18n.t(`trackers:${ns}.strengthLabel`),
    figure: String(score),
    a11y: i18n.t(`trackers:${ns}.strengthA11y`, { score }),
  };
}

export function skippedCaption(): TrackerCardCaption {
  const text = i18n.t('trackers:skip.skippedToday');
  return { text, a11y: text };
}

/**
 * Home caption for a habit, in priority order:
 * 1. skipped today → "Skipped today" (in words, never by dimming the row);
 * 2. a live run → "4 days in a row" / "2 weeks in a row";
 * 3. a broken run with history left → "Strength 62" — a miss shows what is
 *    left, not what was lost (there is deliberately no "missed N days" line);
 * 4. nothing.
 * Streak and strength both honour `showStreakOnCard`.
 */
export function habitCardCaption(
  config: HabitConfig,
  state: { streak?: number; score?: number; skipped?: boolean },
): TrackerCardCaption | null {
  if (state.skipped) return skippedCaption();
  const streakLabel = formatHabitStreakLabel(config, state.streak);
  if (streakLabel) return { text: streakLabel, a11y: streakLabel };
  if (!shouldShowHabitStreakOnCard(config)) return null;
  const score = state.score ?? 0;
  return score > 0 ? strengthCaption(score, 'habitWidget') : null;
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
