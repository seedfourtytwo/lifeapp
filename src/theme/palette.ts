import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Colours that are not Paper roles but still paint words and marks.
 *
 * They live beside the themes, per theme, so a screen never hard-codes a hex
 * that only works on one ground. `__tests__/themeContrast.test.ts` holds every
 * one of them to the body-text floor on both the card and the page.
 */
export interface AppPalette {
  /**
   * The highlight for peeks, pickers and history marks. The brand colour in
   * the slate themes; in cartoon a deep honey, because its bright gold
   * `secondary` (#E8A317) is a fill and reads at 2:1 as a line or a glyph.
   */
  accent: string;
  /** The notebook amber. The old #CA8A04 sat at 2.8:1 on white. */
  amber: string;
  /** One colour per compared series in Insights, in order. */
  series: readonly [string, string, string, string, string];
  /** The empty part of a progress bar: one step darker than the card it is in. */
  track: string;
}

const LIGHT: AppPalette = {
  accent: '#0F766E',
  amber: '#B45309',
  series: ['#0F766E', '#1D4ED8', '#B45309', '#BE185D', '#6D28D9'],
  track: '#CBD5E1',
};

const DARK: AppPalette = {
  accent: '#2DD4BF',
  amber: '#FBBF24',
  series: ['#2DD4BF', '#60A5FA', '#FBBF24', '#F472B6', '#A78BFA'],
  track: '#526175',
};

const CARTOON: AppPalette = {
  accent: '#7E5F10',
  amber: '#9A5B00',
  series: ['#367A2E', '#1D4ED8', '#9A5B00', '#BE185D', '#6D28D9'],
  track: '#BCD495',
};

const PALETTES: Record<ResolvedTheme, AppPalette> = {
  light: LIGHT,
  dark: DARK,
  cartoon: CARTOON,
};

export function getAppPalette(mode: ResolvedTheme): AppPalette {
  return PALETTES[mode];
}
