import type { ViewStyle } from 'react-native';
import type { ThemeDecorations } from '../theme/decorations';

export type TrackerCardChromeInput = {
  isCartoon: boolean;
  decorations: ThemeDecorations;
  /** Shared fill for every Home tracker card (all kinds, all states). */
  fillColor: string;
  outlineColor: string;
};

/**
 * Shared chrome for Home tracker cards — identical fill for every kind.
 * Progress is never painted on the card background (bar only).
 */
export function getTrackerCardChrome({
  isCartoon,
  decorations: deco,
  fillColor,
  outlineColor,
}: TrackerCardChromeInput): Pick<
  ViewStyle,
  'borderRadius' | 'borderWidth' | 'borderColor' | 'backgroundColor'
> {
  return {
    borderRadius: deco.radius.md,
    borderWidth: isCartoon ? deco.cardBorderWidth : 0,
    ...(isCartoon ? { borderColor: outlineColor } : {}),
    backgroundColor: fillColor,
  };
}
