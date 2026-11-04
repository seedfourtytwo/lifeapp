import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Colours that are not Paper roles but still paint words and marks.
 *
 * They live beside the themes, per theme, so a screen never hard-codes a hex
 * that only works on one ground. `__tests__/themeContrast.test.ts` holds every
 * one of them to the body-text floor on both the card and the page.
 */
export interface AppPalette {
  /** The highlight for peeks, pickers and history marks: the moss itself. */
  accent: string;
  /**
   * The notebook amber, for the small colour dot a notebook carries. Deep
   * enough to read as a mark on the page; the old #CA8A04 sat at 2.8:1.
   */
  amber: string;
  /** One colour per compared series in Insights, in order. Moss leads. */
  series: readonly [string, string, string, string, string];
  /** The empty part of a progress bar or strip: visible on a tile and in a well. */
  track: string;
}

const LIGHT: AppPalette = {
  accent: '#2E6A4E',
  amber: '#9A5B00',
  series: ['#2E6A4E', '#1D4ED8', '#9A5B00', '#BE185D', '#5B4BB0'],
  track: '#BCC4BD',
};

const DARK: AppPalette = {
  accent: '#86C9A3',
  amber: '#F0B85A',
  series: ['#86C9A3', '#93B4F5', '#F0B85A', '#F28AB8', '#B9A9F0'],
  track: '#3D4640',
};

const PALETTES: Record<ResolvedTheme, AppPalette> = {
  light: LIGHT,
  dark: DARK,
};

export function getAppPalette(mode: ResolvedTheme): AppPalette {
  return PALETTES[mode];
}
