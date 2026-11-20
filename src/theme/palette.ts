import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Colours that are not Paper roles but still paint words and marks.
 *
 * They live beside the themes, per theme, so a screen never hard-codes a hex
 * that only works on one ground. `__tests__/themeContrast.test.ts` holds every
 * one of them to the body-text floor on both the card and the page.
 */
export type KindColour = 'timer' | 'tick' | 'counter' | 'todo';

export interface KindPaint {
  /** The kind's own colour: its tile, its control's glyph, its ring. Passes as text on a tile and the page. */
  ink: string;
  /** A flat wash of that colour on a tile: the ground of the kind's control. `ink` passes as text on it. */
  wash: string;
}

/** One shade of Review's heat map. */
export interface HeatStep {
  fill: string;
  /** The theme colour a day's number takes on this shade — the one that passes as text on it. */
  onFill: 'onSurface' | 'onPrimary';
}

export interface AppPalette {
  /** The highlight for peeks, pickers and history marks: the moss itself. */
  accent: string;
  /**
   * The notebook amber, for the small colour dot a notebook carries. Deep
   * enough to read as a mark on the page, which the stored #CA8A04 is not.
   */
  amber: string;
  /** The empty part of a progress bar or strip: visible on a tile and in a well. */
  track: string;
  /**
   * One colour per kind of row, the same four the lock-screen widget wears:
   * timers amber, tick-off habits moss, counters blue, todos lilac.
   */
  kind: Record<KindColour, KindPaint>;
  /** The glyph drawn on a tile filled with a kind's ink. */
  onKind: string;
  /**
   * Review's heat map, least to most: the well for a day with nothing done, so
   * an empty stretch recedes into the card; the theme's primary for a day done
   * whole; three flat steps between them.
   */
  heat: readonly [HeatStep, HeatStep, HeatStep, HeatStep, HeatStep];
}

const LIGHT: AppPalette = {
  accent: '#2E6A4E',
  amber: '#8F5400',
  track: '#C4BAAE',
  kind: {
    timer: { ink: '#8F5400', wash: '#EFE4D4' },
    tick: { ink: '#2E6A4E', wash: '#E2E8DF' },
    counter: { ink: '#3E5C76', wash: '#E4E6E5' },
    todo: { ink: '#6B4C7A', wash: '#EAE3E6' },
  },
  onKind: '#FFFCF7',
  // The well, then even quarter steps from the track's tone up to the moss.
  heat: [
    { fill: '#E7E0D7', onFill: 'onSurface' },
    { fill: '#9FA696', onFill: 'onSurface' },
    { fill: '#79927E', onFill: 'onSurface' },
    { fill: '#547E66', onFill: 'onPrimary' },
    { fill: '#2E6A4E', onFill: 'onPrimary' },
  ],
};

const DARK: AppPalette = {
  accent: '#86C9A3',
  amber: '#F0B85A',
  track: '#564D7A',
  kind: {
    timer: { ink: '#F0B85A', wash: '#524148' },
    tick: { ink: '#86C9A3', wash: '#3C4456' },
    counter: { ink: '#9DB8D3', wash: '#414160' },
    todo: { ink: '#C3A8D1', wash: '#493E5F' },
  },
  onKind: '#1D1630',
  // The well, then steps each about 1.4 times brighter than the one before,
  // plum turning to moss.
  heat: [
    { fill: '#383058', onFill: 'onSurface' },
    { fill: '#4B726F', onFill: 'onSurface' },
    { fill: '#609486', onFill: 'onPrimary' },
    { fill: '#73AF95', onFill: 'onPrimary' },
    { fill: '#86C9A3', onFill: 'onPrimary' },
  ],
};

const PALETTES: Record<ResolvedTheme, AppPalette> = {
  light: LIGHT,
  dark: DARK,
};

export function getAppPalette(mode: ResolvedTheme): AppPalette {
  return PALETTES[mode];
}
