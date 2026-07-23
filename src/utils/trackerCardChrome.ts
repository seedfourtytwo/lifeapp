import type { ViewStyle } from 'react-native';
import type { ThemeDecorations } from '../theme/decorations';

export type TrackerCardChromeInput = {
  decorations: ThemeDecorations;
  /** Shared fill for every Home tracker card (all kinds, all states). */
  fillColor: string;
  outlineColor: string;
};

/**
 * Shared chrome for Home tracker cards — identical outline for every kind.
 * Progress paints inside the card; it never replaces this border.
 */
export function getTrackerCardChrome({
  decorations: deco,
  fillColor,
  outlineColor,
}: TrackerCardChromeInput): Pick<
  ViewStyle,
  'borderRadius' | 'borderWidth' | 'borderColor' | 'backgroundColor'
> {
  return {
    borderRadius: deco.radius.md,
    borderWidth: deco.cardBorderWidth,
    borderColor: outlineColor,
    backgroundColor: fillColor,
  };
}
