import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Border widths, corner radii, and sizes that vary by theme.
 *
 * Nothing here is a hairline. `StyleSheet.hairlineWidth` is a sub-pixel line —
 * 0.38dp on a modern phone — and it renders as a grey haze rather than an edge,
 * so a card outlined that way looked unfinished rather than quiet. Light and
 * dark now separate a card from the page by fill; cartoon keeps its heavy
 * outline, which is the point of that theme. `noHairlines.test.ts` keeps it so.
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
  /**
   * A stroke that means something — a selected day, a picked icon, the edge of
   * a control. Wide enough to read as drawn rather than as an artefact.
   */
  borderWidth: number;
  /**
   * The edge of a card. Zero everywhere except cartoon, where the outline is
   * the theme's whole idea: a card separates from the page by its own fill, and
   * a hairline around it only ever read as a smudge.
   */
  cardBorderWidth: number;
  radius: RadiusScale;
  tabRadius: number;
  progressHeight: number;
  buttonRadius: number;
  headerBorderWidth: number;
}

const PLAIN_DECORATIONS: ThemeDecorations = {
  borderWidth: 1.5,
  cardBorderWidth: 0,
  radius: { xs: 2, sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
  tabRadius: 12,
  progressHeight: 3,
  buttonRadius: 8,
  headerBorderWidth: 0,
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
  return mode === 'cartoon' ? CARTOON_DECORATIONS : PLAIN_DECORATIONS;
}
