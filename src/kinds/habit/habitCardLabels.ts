import { i18n } from '../../i18n';
import { shouldShowHabitStreakOnCard, type HabitConfig } from '../../protocol';

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

/** Optional schedule / target blurb (History / details — not Home one-liners). */
export function formatHabitCardDescription(description: string | undefined): string | null {
  const desc = description?.trim();
  return desc ? desc : null;
}
