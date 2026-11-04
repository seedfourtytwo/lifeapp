import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import type { ResolvedTheme } from '../protocol/appSettings';

export const brand = {
  /**
   * Teal-700, not teal-600. One step down the same ramp buys 5.2:1 on the light
   * background where 600 only managed 3.6:1 — the accent tints real text (active
   * tab, streak counts, links), so it is held to the body-text floor.
   * `__tests__/themeContrast.test.ts` keeps every pair honest.
   */
  primary: '#0F766E',
  primaryLight: '#2DD4BF',
  error: '#B00020',
} as const;

/**
 * Every colour Paper owns that the roles above do not name. Left at MD3's
 * defaults they are Material's purple seed — the elevation ramp painted the
 * search bar lavender, and the inverse and disabled washes carry the same
 * tint. Each is mapped onto the slate ramp the rest of the theme already uses.
 * `__tests__/themeNoLavender.test.ts` checks every colour a theme carries.
 */
const SLATE_LIGHT_REST = {
  onSecondary: '#042F2E',
  tertiary: '#0369A1',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E0F2FE',
  onTertiaryContainer: '#0C4A6E',
  onBackground: '#0F172A',
  surfaceDisabled: 'rgba(15, 23, 42, 0.12)',
  onSurfaceDisabled: 'rgba(15, 23, 42, 0.38)',
  inverseSurface: '#1E293B',
  inverseOnSurface: '#F1F5F9',
  inversePrimary: '#5EEAD4',
  backdrop: 'rgba(15, 23, 42, 0.4)',
  // Raised things (menus, the search bar) are white on the stepped page; the
  // shadow does the lifting, not a tint.
  elevation: {
    level0: 'transparent',
    level1: '#FFFFFF',
    level2: '#FFFFFF',
    level3: '#FFFFFF',
    level4: '#FFFFFF',
    level5: '#FFFFFF',
  },
} as const;

const SLATE_DARK_REST = {
  onSecondary: '#042F2E',
  tertiary: '#7DD3FC',
  onTertiary: '#082F49',
  tertiaryContainer: '#0C4A6E',
  onTertiaryContainer: '#E0F2FE',
  onBackground: '#E2E8F0',
  surfaceDisabled: 'rgba(226, 232, 240, 0.12)',
  onSurfaceDisabled: 'rgba(226, 232, 240, 0.38)',
  inverseSurface: '#E2E8F0',
  inverseOnSurface: '#1E293B',
  inversePrimary: '#0F766E',
  backdrop: 'rgba(2, 6, 23, 0.6)',
  // In the dark, height reads as lightness: each level a step up the slate ramp.
  elevation: {
    level0: 'transparent',
    level1: '#1E293B',
    level2: '#233148',
    level3: '#273449',
    level4: '#2B3A50',
    level5: '#334155',
  },
} as const;

export const appLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#CCFBF1',
    onPrimaryContainer: '#115E59',
    secondary: brand.primaryLight,
    // Paper paints the selected segment of SegmentedButtons with these two.
    // Left unset they fall back to Material's default lavender, which appears
    // nowhere else in the app.
    secondaryContainer: '#CCFBF1',
    onSecondaryContainer: '#115E59',
    error: brand.error,
    // One step below the card, so a card stands off the page by its own fill
    // and needs no outline (decorations.ts sets light cards borderless).
    background: '#F1F3F6',
    surface: '#FFFFFF',
    // Set explicitly: the MD3 default is a purple-biased near-black.
    onSurface: '#0F172A',
    surfaceVariant: '#F1F5F9',
    // Muted, but muted enough to still pass on the tightest ground it lands on
    // (surfaceVariant). Secondary text gets its quiet from this token alone.
    onSurfaceVariant: '#5A6B80',
    outlineVariant: '#E2E8F0',
    outline: '#CBD5E1',
    ...SLATE_LIGHT_REST,
  },
};

export const appDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 12,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#2DD4BF',
    onPrimary: '#042F2E',
    primaryContainer: '#134E4A',
    onPrimaryContainer: '#99F6E4',
    secondary: brand.primaryLight,
    secondaryContainer: '#134E4A',
    onSecondaryContainer: '#CCFBF1',
    // #CF6679 only reached 4.1:1 on the dark surface.
    error: '#FCA5A5',
    onError: '#450A0A',
    background: '#0F172A',
    surface: '#1E293B',
    onSurface: '#E2E8F0',
    surfaceVariant: '#334155',
    onSurfaceVariant: '#A9B6C7',
    outlineVariant: '#334155',
    outline: '#475569',
    ...SLATE_DARK_REST,
  },
};

/** Warm, playful look with rounded panels and golden accents. */
export const appCartoonTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    // Deepened from #4A9E3F: white-on-green only reached 3.3:1 there.
    primary: '#367A2E',
    onPrimary: '#FFFDF5',
    primaryContainer: '#C8E6A0',
    onPrimaryContainer: '#2D5A24',
    secondary: '#E8A317',
    onSecondary: '#3D2914',
    secondaryContainer: '#FFE082',
    onSecondaryContainer: '#5C3D0A',
    tertiary: '#5B9BD5',
    onTertiary: '#FFFDF5',
    tertiaryContainer: '#DCEBF7',
    onTertiaryContainer: '#1F4E79',
    // Deepened from #E05252 (3.6:1 on the cream surface).
    error: '#B3271E',
    onError: '#FFFDF5',
    errorContainer: '#FFE8E8',
    onErrorContainer: '#8B1A1A',
    // A shade under the cream card, the same step the slate themes take.
    background: '#FBF0D4',
    surface: '#FFF9E6',
    surfaceVariant: '#E8F5D6',
    onSurface: '#3D2914',
    onSurfaceVariant: '#6B5344',
    outline: '#8B6914',
    outlineVariant: '#C4A574',
    onBackground: '#3D2914',
    surfaceDisabled: 'rgba(61, 41, 20, 0.12)',
    onSurfaceDisabled: 'rgba(61, 41, 20, 0.38)',
    inverseSurface: '#3D2914',
    inverseOnSurface: '#FFF9E6',
    inversePrimary: '#A5D68C',
    backdrop: 'rgba(61, 41, 20, 0.4)',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: '#FFF9E6',
      level1: '#FFF9E6',
      level2: '#FFF3D6',
      level3: '#FFEFC2',
      level4: '#FFEFC2',
      level5: '#FFE8A8',
    },
  },
};

export function getAppTheme(mode: ResolvedTheme): MD3Theme {
  switch (mode) {
    case 'dark':
      return appDarkTheme;
    case 'cartoon':
      return appCartoonTheme;
    default:
      return appLightTheme;
  }
}
