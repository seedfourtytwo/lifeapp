import { i18n } from '../../i18n';
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
