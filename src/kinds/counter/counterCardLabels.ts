import { i18n } from '../../i18n';
import { shouldShowCounterStreakOnCard, type CounterConfig } from '../../protocol';

/** Target-hit streak copy for the counter card subline. */
export function formatCounterStreakLabel(
  config: CounterConfig,
  streak?: number,
): string | null {
  if (!shouldShowCounterStreakOnCard(config)) return null;
  const days = streak ?? 0;
  if (days <= 0) return null;
  return days === 1
    ? i18n.t('trackers:counterWidget.streakOne')
    : i18n.t('trackers:counterWidget.streakMany', { count: days });
}
