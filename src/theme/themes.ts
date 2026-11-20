import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import type { ResolvedTheme } from '../protocol/appSettings';

/**
 * Life wears the same dress as its lock-screen widget
 * (`modules/life-widget/android/src/main/res/values/colors.xml`): a plum
 * ground with cream type in the evening, warm paper with plum ink by day, and
 * one moss green that appears only when something is done or can be done.
 *
 * Every Paper role is set here, so a screen picks the look up by naming a role
 * and never a hex. Roles nothing in the app should reach for (tertiary, the
 * inverse primary) are still mapped onto the same ramp: left at MD3's defaults
 * they are Material's purple seed, and one leaking through paints a control
 * lavender beside the app's plum. `themeTokens.test.ts` pins the roles,
 * `themeContrast.test.ts` every pair the app renders,
 * `themeNoMaterialSeed.test.ts` every colour a theme carries.
 */

/**
 * Day: warm paper. The tile is a step lighter than the ground, so rows read as
 * separate objects by tone alone, with no outline drawn round them.
 */
const LIGHT = {
  ground: '#F1ECE6',
  surface: '#FFFCF7',
  well: '#E7E0D7',
  ink: '#221C2E',
  ink2: '#5F5870',
  line: '#DDD5CB',
  moss: '#2E6A4E',
  mossTint: '#DCEADF',
  onMossTint: '#1E4A35',
  onMoss: '#FFFFFF',
  danger: '#B3261E',
} as const;

/**
 * Evening: the widget's plum. Moss lightens so done states glow, and the tile
 * sits a clear step above the ground, so rows separate by tone alone here too.
 */
const DARK = {
  ground: '#1B1630',
  surface: '#2A2343',
  well: '#383058',
  ink: '#F6F1E8',
  ink2: '#B3AEC6',
  line: '#40385F',
  moss: '#86C9A3',
  mossTint: '#2B4A46',
  onMossTint: '#BFE3CD',
  onMoss: '#14251C',
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
    outline: '#B0A79C',
    outlineVariant: LIGHT.line,
    inverseSurface: LIGHT.ink,
    inverseOnSurface: '#F6F1E8',
    inversePrimary: DARK.moss,
    surfaceDisabled: 'rgba(34, 28, 46, 0.12)',
    onSurfaceDisabled: 'rgba(34, 28, 46, 0.38)',
    shadow: LIGHT.ink,
    scrim: LIGHT.ink,
    backdrop: 'rgba(34, 28, 46, 0.36)',
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
    outline: '#6A6288',
    outlineVariant: DARK.line,
    inverseSurface: DARK.ink,
    inverseOnSurface: DARK.surface,
    inversePrimary: LIGHT.moss,
    surfaceDisabled: 'rgba(246, 241, 232, 0.12)',
    onSurfaceDisabled: 'rgba(246, 241, 232, 0.38)',
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    elevation: flatElevation(DARK.surface),
  },
};

export function getAppTheme(mode: ResolvedTheme): MD3Theme {
  return mode === 'dark' ? appDarkTheme : appLightTheme;
}
