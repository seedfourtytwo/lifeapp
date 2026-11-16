import type { ActionBubble } from '../components/ActionBubbleTray';
import { i18n } from '../i18n';

/**
 * The "Skip today" / "Undo skip" bubble a Home row offers in its long-press
 * tray. None when the day is complete — a done day has nothing to skip.
 * No confirm: the row's Undo snackbar is the safety net.
 */
export function skipTodayBubbles(opts: {
  complete: boolean;
  skipped: boolean;
  onSkipToday?: (skip: boolean) => void;
}): ActionBubble[] {
  const { complete, skipped, onSkipToday } = opts;
  if (!onSkipToday || complete) return [];
  return skipped
    ? [
        {
          key: 'unskip',
          icon: 'undo-variant',
          accessibilityLabel: i18n.t('trackers:skip.undoSkipA11y'),
          onPress: () => onSkipToday(false),
        },
      ]
    : [
        {
          key: 'skip',
          icon: 'debug-step-over',
          accessibilityLabel: i18n.t('trackers:skip.skipTodayA11y'),
          onPress: () => onSkipToday(true),
        },
      ];
}
