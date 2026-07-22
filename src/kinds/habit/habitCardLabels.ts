import { shouldShowHabitStreakOnCard, type HabitConfig } from '../../protocol';

/**
 * Success-streak copy for the habit card subline.
 * Independent of whether today is complete — a run through yesterday still shows
 * so the streak motivates check-off.
 */
export function formatHabitStreakLabel(
  config: HabitConfig,
  streak?: number,
): string | null {
  if (!shouldShowHabitStreakOnCard(config)) return null;
  const days = streak ?? 0;
  if (days <= 0) return null;
  return days === 1 ? '1-day streak' : `${days}-day streak`;
}

/** Optional schedule / target blurb under the title (separate from streak). */
export function formatHabitCardDescription(description: string | undefined): string | null {
  const desc = description?.trim();
  return desc ? desc : null;
}
