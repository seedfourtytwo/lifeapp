import { i18n } from '../../i18n';
import {
  skippedCaption,
  strengthCaption,
  type TrackerCardCaption,
} from '../habit/habitCardLabels';
import { shouldShowCounterStreakOnCard, type CounterConfig } from '../../protocol';

/** Target-hit streak day count for compact Home card display. */
export function getCounterStreakDays(
  config: CounterConfig,
  streak?: number,
): number | null {
  if (!shouldShowCounterStreakOnCard(config)) return null;
  const days = streak ?? 0;
  if (days <= 0) return null;
  return days;
}

/** Target-hit streak copy for accessibility (and any non-compact surfaces). */
export function formatCounterStreakLabel(
  config: CounterConfig,
  streak?: number,
): string | null {
  const days = getCounterStreakDays(config, streak);
  if (days == null) return null;
  return days === 1
    ? i18n.t('trackers:counterWidget.streakOne')
    : i18n.t('trackers:counterWidget.streakMany', { count: days });
}

/**
 * Home caption for a counter with a daily target — the same priority as
 * `habitCardCaption`: skipped, then the run, then strength once it has broken.
 */
export function counterCardCaption(
  config: CounterConfig,
  state: { streak?: number; score?: number; skipped?: boolean },
): TrackerCardCaption | null {
  if (!shouldShowCounterStreakOnCard(config)) {
    return state.skipped ? skippedCaption() : null;
  }
  if (state.skipped) return skippedCaption();
  const streakLabel = formatCounterStreakLabel(config, state.streak);
  if (streakLabel) return { text: streakLabel, a11y: streakLabel };
  const score = state.score ?? 0;
  return score > 0 ? strengthCaption(score, 'counterWidget') : null;
}
