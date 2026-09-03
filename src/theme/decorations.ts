import { StyleSheet } from 'react-native';
import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Border widths, corner radii, and sizes that vary by theme.
 *
 * The radius scale is what makes the cartoon theme feel like a different app
 * rather than a recoloured one, so it has to cover what components actually
 * need. A scale of three did not: twenty-nine literal radii had grown up around
 * it, and every one stayed at its light-theme roundness whichever theme was on.
 * The steps below are named for what they wrap.
 */
export interface RadiusScale {
  /** Hairline chips: a progress bar cap, a slash, a tick. */
  xs: number;
  /** Small inline things: tags, badges, segment ends. */
  sm: number;
  /** The default for a control — buttons, inputs, wells. */
  md: number;
  /** Cards and rows. */
  lg: number;
  /** Sheets and panels. */
  xl: number;
  /** Fully round, for anything circular. Never varies by theme. */
  pill: number;
}

export interface ThemeDecorations {
  borderWidth: number;
  cardBorderWidth: number;
  radius: RadiusScale;
  tabRadius: number;
  progressHeight: number;
  buttonRadius: number;
  headerBorderWidth: number;
}

const LIGHT_DECORATIONS: ThemeDecorations = {
  borderWidth: 1,
  cardBorderWidth: 1,
  radius: { xs: 2, sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
  tabRadius: 12,
  progressHeight: 3,
  buttonRadius: 8,
  headerBorderWidth: StyleSheet.hairlineWidth,
};

const CARTOON_DECORATIONS: ThemeDecorations = {
  borderWidth: 2,
  cardBorderWidth: 3,
  radius: { xs: 4, sm: 14, md: 18, lg: 22, xl: 28, pill: 999 },
  tabRadius: 18,
  progressHeight: 8,
  buttonRadius: 14,
  headerBorderWidth: 3,
};

export function getThemeDecorations(mode: ResolvedTheme): ThemeDecorations {
  return mode === 'cartoon' ? CARTOON_DECORATIONS : LIGHT_DECORATIONS;
}
