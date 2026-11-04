import type { JournalNotebookColor } from '../protocol';
import type { ResolvedTheme } from '../protocol/appSettings';
import { getAppPalette } from '../theme/palette';

/**
 * The stored palette names a notebook; it is not tuned to any one ground.
 * These are the shades that keep the same hue but clear 3:1 on each theme's
 * page and tile, where a notebook's colour dot and journal marks land. Amber
 * is the theme's own `amber`; anything else not listed already reads.
 */
const ON_LIGHT: Partial<Record<JournalNotebookColor, string>> = {
  '#0D9488': '#0F766E',
  '#16A34A': '#15803D',
  '#EA580C': '#C2410C',
};

const ON_DARK: Partial<Record<JournalNotebookColor, string>> = {
  '#64748B': '#94A3B8',
  '#2563EB': '#60A5FA',
  '#DC2626': '#F87171',
  '#9333EA': '#C084FC',
};

/** The colour a notebook's mark paints with in the theme being painted. */
export function notebookInk(color: JournalNotebookColor, theme: ResolvedTheme): string {
  if (color === '#CA8A04') return getAppPalette(theme).amber;
  return (theme === 'dark' ? ON_DARK : ON_LIGHT)[color] ?? color;
}
