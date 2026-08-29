/**
 * Contrast floor for every theme.
 *
 * Text has to clear WCAG AA (4.5:1) against the surface it actually sits on.
 * These are the pairs the app really renders — a theme is only as good as its
 * worst one, and the worst one is usually a pair nobody looked at.
 *
 * Two rules this file exists to keep:
 *  - text is muted by choosing a muted token, never by lowering opacity over a
 *    token that was already muted (the two compound: 0.6 over `onSurfaceVariant`
 *    lands near 2.2:1, which is why no text style in `src/` sets `opacity`);
 *  - a new theme ships only once it passes the same table as the old ones.
 *
 * Deliberately not asserted: `outline` / `outlineVariant`. Those are hairline
 * dividers and card edges — decoration, not state — so WCAG 1.4.11 does not
 * reach them. `secondary` and `tertiary` are likewise fill colours, checked
 * against their own `on*` pair rather than against a surface.
 */
import { appCartoonTheme, appDarkTheme, appLightTheme } from '../src/theme/themes';

const AA_TEXT = 4.5;

/** Accepts both `#RRGGBB` and the `rgba(r, g, b, a)` strings MD3 ships. */
function parseColor(value: string): [number, number, number] {
  const rgba = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];

  const hex = value.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Unsupported colour format: ${value}`);
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** Relative luminance per WCAG 2.1. */
function luminance(color: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseColor(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composite `fg` at `alpha` over `bg`, the way `opacity` on a Text renders. */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  const [fr, fgc, fb] = parseColor(fg);
  const [br, bgc, bb] = parseColor(bg);
  const mix = (f: number, b: number) =>
    Math.round(f * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(fr, br)}${mix(fgc, bgc)}${mix(fb, bb)}`;
}

const THEMES = [
  { name: 'light', theme: appLightTheme },
  { name: 'dark', theme: appDarkTheme },
  { name: 'cartoon', theme: appCartoonTheme },
] as const;

describe.each(THEMES)('$name theme', ({ theme }) => {
  const c = theme.colors;

  /**
   * Every pair where the app puts words on a ground. `surfaceVariant` is in
   * here because tinted panels (the week-plants card, icon wells) put muted
   * text on it, and that is the tightest pair in both slate themes.
   */
  const textPairs: [string, string, string][] = [
    ['body text on surface', c.onSurface, c.surface],
    ['body text on background', c.onSurface, c.background],
    ['secondary text on surface', c.onSurfaceVariant, c.surface],
    ['secondary text on background', c.onSurfaceVariant, c.background],
    ['secondary text on surfaceVariant', c.onSurfaceVariant, c.surfaceVariant],
    ['error text on surface', c.error, c.surface],
    ['error text on background', c.error, c.background],
    // Filled containers carry their own label colour.
    ['label on primary', c.onPrimary, c.primary],
    ['label on primaryContainer', c.onPrimaryContainer, c.primaryContainer],
    ['label on error', c.onError, c.error],
    // Paper's SegmentedButtons paints the selected segment with these two.
    ['label on secondaryContainer', c.onSecondaryContainer, c.secondaryContainer],
  ];

  it.each(textPairs)('%s clears AA', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  /**
   * The accent tints real text — active tab labels, streak counts, links — so
   * it is held to the text floor rather than the 3:1 non-text one.
   */
  it.each([
    ['accent text on background', c.primary, c.background],
    ['accent text on surface', c.primary, c.surface],
  ])('%s clears AA', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  /**
   * The reason no text style in this codebase sets `opacity`: the token is
   * chosen to pass at full strength, and dimming it throws that away.
   */
  it('secondary text would drop below AA if dimmed to 60% opacity', () => {
    const dimmed = compositeOver(c.onSurfaceVariant, c.background, 0.6);
    expect(contrastRatio(c.onSurfaceVariant, c.background)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
    expect(contrastRatio(dimmed, c.background)).toBeLessThan(AA_TEXT);
  });
});
