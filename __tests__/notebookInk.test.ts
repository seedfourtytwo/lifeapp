/**
 * Notebook icons are drawn in the notebook's own colour, on the page and on a
 * 20% wash of that colour. The stored palette is identity, not ink: amber on
 * white is 2.8:1 and purple on the dark surface 2.7:1. `notebookInk` is the
 * colour an icon actually paints with, and it has to clear the 3:1 floor
 * WCAG 1.4.11 sets for graphics everywhere it lands.
 */
import { JOURNAL_NOTEBOOK_COLORS } from '../src/protocol';
import { notebookInk } from '../src/notes/notebookInk';
import { appDarkTheme, appLightTheme } from '../src/theme/themes';

const GRAPHIC_FLOOR = 3;
const WELL_ALPHA = 0x33 / 255;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function wash(fg: string, bg: string): string {
  const f = rgb(fg);
  const g = rgb(bg);
  return `#${f
    .map((v, i) => Math.round(v * WELL_ALPHA + g[i] * (1 - WELL_ALPHA)).toString(16).padStart(2, '0'))
    .join('')}`;
}

const themes = { light: appLightTheme, dark: appDarkTheme } as const;

describe('notebookInk', () => {
  for (const name of ['light', 'dark'] as const) {
    const theme = themes[name];
    for (const color of JOURNAL_NOTEBOOK_COLORS) {
      it(`${color} clears 3:1 in the ${name} theme, on the page and in its well`, () => {
        const ink = notebookInk(color, name);
        for (const ground of [theme.colors.background, theme.colors.surface]) {
          expect(ratio(ink, ground)).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
          expect(ratio(ink, wash(ink, ground))).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
        }
      });
    }
  }

  it('keeps every hue that already reads', () => {
    expect(notebookInk('#2563EB', 'light')).toBe('#2563EB');
  });
});
