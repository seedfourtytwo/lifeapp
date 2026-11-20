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
   * text on it, and that is the tightest pair in both themes.
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
 * accent, the notebook amber and one colour per kind. Each sits on the same
 * grounds as body text and is held to the same floor, because each of them
 * colours a label somewhere (a chip, a peek title, a notebook name, a count).
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
  ];

  it.each(inks.flatMap(([ink, fg]) => grounds.map(([g, bg]) => [`${ink} on ${g}`, fg, bg])))(
    '%s clears AA',
    (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  /**
   * A tracker history's day cells are marks, not words, so they answer to the
   * 3:1 floor for graphics: a missed day's ring and a skipped day's dot in the
   * quiet ink, an open day's ring in the accent. `palette.track` would not
   * hold it.
   */
  it.each([
    ['missed ring on a tile', c.onSurfaceVariant, c.surface],
    ['open ring on a tile', palette.accent, c.surface],
  ])('%s clears the non-text floor', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  /**
   * Review's heat map: five flat shades from the empty well to the accent.
   * Neighbours have to be told apart at a glance, the faintest has to show on
   * the tile, and a day's number is text on its square — so each shade names
   * the theme ink that clears the text floor on it.
   */
  describe('heat map', () => {
    const { heat } = palette;

    it('runs from the empty well to the accent', () => {
      expect(heat).toHaveLength(5);
      expect(heat[0].fill).toBe(c.surfaceVariant);
      expect(heat[4].fill).toBe(c.primary);
    });

    it.each([0, 1, 2, 3])('level %i differs visibly from the next, which is stronger', (level) => {
      const [here, next] = [heat[level].fill, heat[level + 1].fill];
      expect(contrastRatio(here, next)).toBeGreaterThanOrEqual(1.15);
      // Each step moves further from the tile, never back towards it.
      expect(contrastRatio(next, c.surface)).toBeGreaterThan(contrastRatio(here, c.surface));
    });

    it.each(heat.map((step, level) => [level, step] as const))(
      'a day number on level %i clears AA',
      (_level, step) => {
        expect(contrastRatio(c[step.onFill], step.fill)).toBeGreaterThanOrEqual(AA_TEXT);
      },
    );

    /** Today's ring, and the number on a day that has not come: drawn on the tile itself. */
    it.each([
      ['today’s ring', c.onSurface, 3],
      ['a coming day’s number', c.onSurfaceVariant, AA_TEXT],
    ])('%s shows on a tile', (_label, fg, floor) => {
      expect(contrastRatio(fg, c.surface)).toBeGreaterThanOrEqual(floor);
    });
  });

  /**
   * A kind's colour is text on a tile and on the page, a ring on a pressed
   * row, the glyph on its own wash, and the fill under the glyph drawn on it.
   */
  describe.each(Object.entries(palette.kind))('%s', (_kind, { ink, wash }) => {
    it.each([
      ['its colour on a tile', ink, c.surface],
      ['its colour on the page', ink, c.background],
      ['its colour on its wash', ink, wash],
      ['the glyph on its colour', palette.onKind, ink],
    ])('%s clears AA', (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('its colour on a pressed row clears the non-text floor', () => {
      expect(contrastRatio(ink, c.surfaceVariant)).toBeGreaterThanOrEqual(3);
    });
  });

  /** An empty track has to show on the tinted cards it sits in, not vanish into them. */
  it.each([
    ['surface', c.surface],
    ['surfaceVariant', c.surfaceVariant],
  ])('progress track is visible on %s', (_g, bg) => {
    expect(contrastRatio(palette.track, bg)).toBeGreaterThanOrEqual(1.3);
  });
});
