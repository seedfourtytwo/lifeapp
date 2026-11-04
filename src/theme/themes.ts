import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Life is a well-made pocket instrument: stone-grey ground, ink-dark type, and
 * one deep moss green that appears only when something is done or can be done.
 *
 * Every Paper role is set here, so a screen picks the look up by naming a role
 * and never a hex. Roles nothing in the app should reach for (tertiary, the
 * inverse primary) are still mapped onto the same ramp: left at MD3's defaults
 * they are Material's purple seed, and one leaking through paints a control
 * lavender. `themeTokens.test.ts` pins the roles, `themeContrast.test.ts` every
 * pair the app renders, `themeNoLavender.test.ts` every colour a theme carries.
 */
const LIGHT = {
  ground: '#ECEEEA',
  surface: '#FFFFFF',
  well: '#E3E7E2',
  ink: '#18201C',
  ink2: '#58635D',
  line: '#D5DAD4',
  moss: '#2E6A4E',
  mossTint: '#DCEADF',
  onMossTint: '#1E4A35',
  onMoss: '#FFFFFF',
  danger: '#B3261E',
} as const;

/** Green-black, not navy: the old slate read as "web app". Moss lightens so done states glow. */
const DARK = {
  ground: '#111513',
  surface: '#1A1F1C',
  well: '#252B27',
  ink: '#E6EBE7',
  ink2: '#9AA59E',
  line: '#2E3530',
  moss: '#86C9A3',
  mossTint: '#203328',
  onMossTint: '#BFE3CD',
  onMoss: '#0E1A13',
  danger: '#F2B8B5',
} as const;

/** Raised things are the surface; the sheet shadow does the lifting, never a tint. */
function flatElevation(surface: string): MD3Theme['colors']['elevation'] {
  return {
    level0: 'transparent',
    level1: surface,
    level2: surface,
    level3: surface,
    level4: surface,
    level5: surface,
  };
}

/**
 * MD3 sizes its own shapes as multiples of `roundness` — a card 3×, a button
 * 5×, a dialog 7×. At the old 12 every dialog came out an 84dp blob. 4 is the
 * value those multiples were designed around; anything we draw ourselves takes
 * its corner from `decorations.radius` instead.
 */
const ROUNDNESS = 4;

export const appLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: ROUNDNESS,
  colors: {
    ...MD3LightTheme.colors,
    primary: LIGHT.moss,
    onPrimary: LIGHT.onMoss,
    primaryContainer: LIGHT.mossTint,
    onPrimaryContainer: LIGHT.onMossTint,
    // Paper paints a selected segment and tonal buttons with the secondary
    // pair; it is the same quiet moss wash as the primary container.
    secondary: LIGHT.moss,
    onSecondary: LIGHT.onMoss,
    secondaryContainer: LIGHT.mossTint,
    onSecondaryContainer: LIGHT.onMossTint,
    tertiary: LIGHT.ink2,
    onTertiary: LIGHT.surface,
    tertiaryContainer: LIGHT.well,
    onTertiaryContainer: LIGHT.ink,
    error: LIGHT.danger,
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',
    background: LIGHT.ground,
    onBackground: LIGHT.ink,
    surface: LIGHT.surface,
    onSurface: LIGHT.ink,
    surfaceVariant: LIGHT.well,
    onSurfaceVariant: LIGHT.ink2,
    outline: '#A9B2AB',
    outlineVariant: LIGHT.line,
    inverseSurface: LIGHT.ink,
    inverseOnSurface: '#EEF2EE',
    inversePrimary: DARK.moss,
    surfaceDisabled: 'rgba(24, 32, 28, 0.12)',
    onSurfaceDisabled: 'rgba(24, 32, 28, 0.38)',
    shadow: LIGHT.ink,
    scrim: LIGHT.ink,
    backdrop: 'rgba(24, 32, 28, 0.36)',
    elevation: flatElevation(LIGHT.surface),
  },
};

export const appDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: ROUNDNESS,
  colors: {
    ...MD3DarkTheme.colors,
    primary: DARK.moss,
    onPrimary: DARK.onMoss,
    primaryContainer: DARK.mossTint,
    onPrimaryContainer: DARK.onMossTint,
    secondary: DARK.moss,
    onSecondary: DARK.onMoss,
    secondaryContainer: DARK.mossTint,
    onSecondaryContainer: DARK.onMossTint,
    tertiary: DARK.ink2,
    onTertiary: DARK.ground,
    tertiaryContainer: DARK.well,
    onTertiaryContainer: DARK.ink,
    error: DARK.danger,
    onError: '#601410',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',
    background: DARK.ground,
    onBackground: DARK.ink,
    surface: DARK.surface,
    onSurface: DARK.ink,
    surfaceVariant: DARK.well,
    onSurfaceVariant: DARK.ink2,
    outline: '#4A544D',
    outlineVariant: DARK.line,
    inverseSurface: DARK.ink,
    inverseOnSurface: DARK.surface,
    inversePrimary: LIGHT.moss,
    surfaceDisabled: 'rgba(230, 235, 231, 0.12)',
    onSurfaceDisabled: 'rgba(230, 235, 231, 0.38)',
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    elevation: flatElevation(DARK.surface),
  },
};

export function getAppTheme(mode: ResolvedTheme): MD3Theme {
  return mode === 'dark' ? appDarkTheme : appLightTheme;
}
