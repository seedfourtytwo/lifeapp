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
import { appDarkTheme, appLightTheme } from '../src/theme/themes';
import { getAppPalette } from '../src/theme/palette';
import { nightColors as n } from '../src/ui/tokens';
import { compositeOver, contrastRatio } from './support/contrast';

const AA_TEXT = 4.5;

export { contrastRatio, compositeOver } from './support/contrast';

const THEMES = [
  { name: 'light', theme: appLightTheme },
  { name: 'dark', theme: appDarkTheme },
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
    // The forecast strip is a tinted panel with full-strength figures on it.
    ['body text on surfaceVariant', c.onSurface, c.surfaceVariant],
    ['error text on surface', c.error, c.surface],
    ['error text on background', c.error, c.background],
    // Filled containers carry their own label colour.
    ['label on primary', c.onPrimary, c.primary],
    ['label on primaryContainer', c.onPrimaryContainer, c.primaryContainer],
    ['label on error', c.onError, c.error],
    // Paper's SegmentedButtons paints the selected segment with these two.
    ['label on secondaryContainer', c.onSecondaryContainer, c.secondaryContainer],
    // The undo bar is the one inverse surface: its line and its Undo action.
    ['undo line on inverseSurface', c.inverseOnSurface, c.inverseSurface],
    ['undo action on inverseSurface', c.inversePrimary, c.inverseSurface],
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

/**
 * Colours that are not Paper roles but still paint words and marks: the
 * accent, the Insights series, the notebook amber. Each sits on
 * the same grounds as body text and is held to the same floor, because each of
 * them colours a label somewhere (a chip, a peek title, a notebook name).
 */
describe.each(THEMES)('$name palette', ({ name, theme }) => {
  const c = theme.colors;
  const palette = getAppPalette(name);
  const grounds: [string, string][] = [
    ['surface', c.surface],
    ['background', c.background],
  ];
  const inks: [string, string][] = [
    ['accent', palette.accent],
    ['amber', palette.amber],
    ...palette.series.map((s, i): [string, string] => [`series ${i}`, s]),
  ];

  it.each(inks.flatMap(([ink, fg]) => grounds.map(([g, bg]) => [`${ink} on ${g}`, fg, bg])))(
    '%s clears AA',
    (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('has five distinct series colours', () => {
    expect(new Set(palette.series).size).toBe(5);
  });

  /** An empty track has to show on the tinted cards it sits in, not vanish into them. */
  it.each([
    ['surface', c.surface],
    ['surfaceVariant', c.surfaceVariant],
  ])('progress track is visible on %s', (_g, bg) => {
    expect(contrastRatio(palette.track, bg)).toBeGreaterThanOrEqual(1.3);
  });
});

/**
 * The Night road kit (`src/ui/`) is its own set of tokens, outside the Paper
 * themes, and is held to the same floor. Text can land on any ground the kit
 * paints: a glass surface anywhere along its gradient, or the night behind it
 * anywhere from the top of the sky down through the horizon to the ground.
 * The lights only ever draw rings and lines beside text, never text, so they
 * are held to the 3:1 a control's edge needs against the glass it rings.
 */
describe('Night road kit', () => {
  const grounds: [string, string][] = [
    ['glass top', n.glassTop],
    ['glass middle', n.glassMiddle],
    ['glass bottom', n.glassBottom],
    ...n.sky.map((stop, i): [string, string] => [`sky stop ${i}`, stop]),
    ['ground', n.ground],
  ];
  const inks: [string, string][] = [
    ['cream', n.cream],
    ['dimmed cream', n.creamDim],
  ];

  it.each(inks.flatMap(([ink, fg]) => grounds.map(([g, bg]) => [`${ink} on ${g}`, fg, bg])))(
    '%s clears AA',
    (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it.each(
    (['violet', 'teal', 'amber'] as const).flatMap((light) =>
      (['glassTop', 'glassBottom'] as const).map((g) => [`${light} ring on ${g}`, n[light], n[g]]),
    ),
  )('%s clears 3:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
