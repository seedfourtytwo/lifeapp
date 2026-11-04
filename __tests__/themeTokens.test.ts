/**
 * The 1.6.0 look, as numbers: stone ground, ink type, one moss green for what
 * is done or can be done, green-black in the dark. Paper's own roles carry it,
 * so every screen picks it up without naming a hex. `.qa/review-premium.md`
 * is where these came from.
 */
import { getThemeDecorations } from '../src/theme/decorations';
import { getAppPalette } from '../src/theme/palette';
import { layout, space } from '../src/theme/spacing';
import { appDarkTheme, appLightTheme } from '../src/theme/themes';
import { typeScale } from '../src/theme/typography';

describe.each([
  [
    'light',
    appLightTheme,
    {
      primary: '#2E6A4E',
      onPrimary: '#FFFFFF',
      primaryContainer: '#DCEADF',
      background: '#ECEEEA',
      surface: '#FFFFFF',
      surfaceVariant: '#E3E7E2',
      onSurface: '#18201C',
      onSurfaceVariant: '#58635D',
      outlineVariant: '#D5DAD4',
      error: '#B3261E',
    },
  ],
  [
    'dark',
    appDarkTheme,
    {
      primary: '#86C9A3',
      onPrimary: '#0E1A13',
      primaryContainer: '#253B2F',
      background: '#0B0E0C',
      surface: '#1C2220',
      surfaceVariant: '#2A312D',
      onSurface: '#E6EBE7',
      onSurfaceVariant: '#9AA59E',
      outlineVariant: '#353D38',
      error: '#F2B8B5',
    },
  ],
] as const)('%s theme', (mode, theme, roles) => {
  it.each(Object.entries(roles))('%s is %s', (role, hex) => {
    expect(theme.colors[role as keyof typeof roles]).toBe(hex);
  });

  /** Raised things are the surface colour; depth comes from shadow, never a tint. */
  it('paints every elevation level as the surface', () => {
    const { level0, ...levels } = theme.colors.elevation;
    expect(level0).toBe('transparent');
    for (const level of Object.values(levels)) expect(level).toBe(theme.colors.surface);
  });

  it('uses moss as the accent', () => {
    expect(getAppPalette(mode).accent).toBe(roles.primary);
  });

  /**
   * MD3 sizes its shapes from `roundness` (a card is 3×, a dialog 7×). At 12
   * every dialog came out an 84dp blob; 4 is the value those multiples assume.
   */
  it('keeps Paper on the roundness its shapes are designed around', () => {
    expect(theme.roundness).toBe(4);
  });
});

describe('shape and space', () => {
  const { radius, sheetShadow, scrim } = getThemeDecorations('light');

  it('steps the radius by what it wraps', () => {
    expect(radius.md).toBe(14); // inputs, segmented controls
    expect(radius.lg).toBe(20); // tiles
    expect(radius.xl).toBe(28); // sheet tops, confirm dialogs
  });

  it('floats sheets and the undo bar on one soft shadow over a scrim', () => {
    expect(sheetShadow).toMatchObject({ shadowOffset: { width: 0, height: -8 }, shadowRadius: 32 });
    expect(sheetShadow.shadowOpacity).toBeCloseTo(0.14);
    expect(scrim).toMatch(/^rgba\(/);
  });

  it('sets the screen rhythm', () => {
    expect(layout).toEqual({ gutter: 20, rowHeight: 72, rowGap: space.sm, sectionGap: space.xl });
  });
});

describe('type', () => {
  it.each([
    ['dayTitle', 34, 40],
    ['screenTitle', 24, 30],
    ['rowName', 17, 22],
    ['body', 17, 24],
    ['secondary', 15, 20],
    ['caption', 13, 18],
    ['meta', 14, 18],
    ['bigStat', 26, 30],
  ] as const)('%s is %ssp on %s', (role, size, line) => {
    expect(typeScale[role]).toMatchObject({ fontSize: size, lineHeight: line });
  });

  /** Mono is for numbers that tick; the status line under the date is words. */
  it('sets the status line in the system face', () => {
    expect(typeScale.meta).not.toHaveProperty('fontFamily');
  });
});
