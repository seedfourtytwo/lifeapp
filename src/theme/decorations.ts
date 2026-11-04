import type { ViewStyle } from 'react-native';
import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Border widths, corner radii, and depth.
 *
 * Nothing here is a hairline. `StyleSheet.hairlineWidth` is a sub-pixel line —
 * 0.38dp on a modern phone — and it renders as a grey haze rather than an edge.
 * A tile separates from the page by its own fill, so there is no card border at
 * all; `noHairlines.test.ts` keeps it so.
 *
 * The radius steps are named for what they wrap, and step up with the size of
 * the thing: an input is rounder than a tag, a tile rounder than an input, a
 * sheet rounder than a tile. One radius on everything is what made the old
 * screens look stamped out.
 */
export interface RadiusScale {
  /** Hairline chips: a progress bar cap, a slash, a tick. */
  xs: number;
  /** Small inline things: tags, badges, segment ends. */
  sm: number;
  /** Inputs, wells and segmented controls. */
  md: number;
  /** Tiles and rows. */
  lg: number;
  /** Sheet tops and confirm dialogs. */
  xl: number;
  /** Fully round: buttons, chips, discs. */
  pill: number;
}

export interface ThemeDecorations {
  /**
   * A stroke that means something — a selected day, a picked icon, the edge of
   * a control. Wide enough to read as drawn rather than as an artefact.
   */
  borderWidth: number;
  radius: RadiusScale;
  tabRadius: number;
  progressHeight: number;
  buttonRadius: number;
  /**
   * The one shadow in the app: sheets and the undo bar float on it. Tiles have
   * none — the page being one step darker is enough.
   */
  sheetShadow: Pick<
    ViewStyle,
    'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
  >;
  /** What dims the screen behind a sheet. */
  scrim: string;
}

const SHARED = {
  borderWidth: 1.5,
  radius: { xs: 2, sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  tabRadius: 14,
  progressHeight: 4,
  buttonRadius: 999,
} as const;

const LIGHT: ThemeDecorations = {
  ...SHARED,
  sheetShadow: {
    shadowColor: '#18201C',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 12,
  },
  scrim: 'rgba(24, 32, 28, 0.36)',
};

const DARK: ThemeDecorations = {
  ...SHARED,
  sheetShadow: { ...LIGHT.sheetShadow, shadowColor: '#000000' },
  scrim: 'rgba(0, 0, 0, 0.5)',
};

export function getThemeDecorations(mode: ResolvedTheme): ThemeDecorations {
  return mode === 'dark' ? DARK : LIGHT;
}
