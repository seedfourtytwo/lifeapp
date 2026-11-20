/**
 * The look, as numbers: an evening plum ground with cream type, a warm paper
 * day ground with plum ink, one moss green for what is done or can be done,
 * and one colour per kind. It is the lock-screen widget's dress, and the
 * evening colours are checked here against the widget's own resource file.
 * Paper's roles carry it, so every screen picks it up without naming a hex.
 */
import fs from 'fs';
import path from 'path';
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
      background: '#F1ECE6',
      surface: '#FFFCF7',
      surfaceVariant: '#E7E0D7',
      onSurface: '#221C2E',
      onSurfaceVariant: '#5F5870',
      outlineVariant: '#DDD5CB',
      outline: '#B0A79C',
      error: '#B3261E',
    },
  ],
  [
    'dark',
    appDarkTheme,
    {
      primary: '#86C9A3',
      onPrimary: '#14251C',
      primaryContainer: '#2B4A46',
      background: '#1B1630',
      surface: '#2A2343',
      surfaceVariant: '#383058',
      onSurface: '#F6F1E8',
      onSurfaceVariant: '#B3AEC6',
      outlineVariant: '#40385F',
      outline: '#6A6288',
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

describe.each([
  [
    'light',
    {
      track: '#C4BAAE',
      amber: '#8F5400',
      onKind: '#FFFCF7',
      kind: {
        timer: { ink: '#8F5400', wash: '#EFE4D4' },
        tick: { ink: '#2E6A4E', wash: '#E2E8DF' },
        counter: { ink: '#3E5C76', wash: '#E4E6E5' },
        todo: { ink: '#6B4C7A', wash: '#EAE3E6' },
      },
    },
  ],
  [
    'dark',
    {
      track: '#564D7A',
      amber: '#F0B85A',
      onKind: '#1D1630',
      kind: {
        timer: { ink: '#F0B85A', wash: '#524148' },
        tick: { ink: '#86C9A3', wash: '#3C4456' },
        counter: { ink: '#9DB8D3', wash: '#414160' },
        todo: { ink: '#C3A8D1', wash: '#493E5F' },
      },
    },
  ],
] as const)('%s palette', (mode, colours) => {
  it('carries the track, the amber and one colour per kind', () => {
    expect(getAppPalette(mode)).toMatchObject(colours);
  });
});

/** The evening theme and the widget are one dress: the same hexes, in two files. */
describe('the widget\'s dress', () => {
  const xml = fs.readFileSync(
    path.join(__dirname, '../modules/life-widget/android/src/main/res/values/colors.xml'),
    'utf8',
  );
  const widget = (name: string): string | undefined =>
    xml.match(new RegExp(`<color name="life_widget_${name}">(#[0-9A-Fa-f]{6})</color>`))?.[1];
  const palette = getAppPalette('dark');

  it.each([
    ['text', appDarkTheme.colors.onSurface],
    ['text_muted', appDarkTheme.colors.onSurfaceVariant],
    ['accent', appDarkTheme.colors.primary],
    ['ink', palette.onKind],
    ['timer', palette.kind.timer.ink],
    ['tick', palette.kind.tick.ink],
    ['counter', palette.kind.counter.ink],
    ['todo', palette.kind.todo.ink],
  ])('life_widget_%s is the evening theme\'s %s', (name, hex) => {
    expect(widget(name)).toBe(hex);
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
    ['dayTitle', 25, 30],
    ['screenTitle', 24, 30],
    ['rowName', 17, 22],
    ['body', 17, 24],
    ['secondary', 15, 20],
    ['dockWord', 16, 22],
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
