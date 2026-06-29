import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import type { ThemeMode } from './types';

export const brand = {
  primary: '#0D9488',
  primaryLight: '#2DD4BF',
  error: '#B00020',
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
    error: brand.error,
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F5F9',
    onSurfaceVariant: '#64748B',
    outlineVariant: '#E2E8F0',
    outline: '#CBD5E1',
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
    error: '#CF6679',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceVariant: '#334155',
    onSurfaceVariant: '#94A3B8',
    outlineVariant: '#334155',
    outline: '#475569',
  },
};

/** Warm, playful look with rounded panels and golden accents. */
export const appCartoonTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#4A9E3F',
    onPrimary: '#FFFDF5',
    primaryContainer: '#C8E6A0',
    onPrimaryContainer: '#2D5A24',
    secondary: '#E8A317',
    onSecondary: '#3D2914',
    secondaryContainer: '#FFE082',
    onSecondaryContainer: '#5C3D0A',
    tertiary: '#5B9BD5',
    onTertiary: '#FFFDF5',
    error: '#E05252',
    onError: '#FFFDF5',
    background: '#FFF8E7',
    surface: '#FFFDF5',
    surfaceVariant: '#E8F5D6',
    onSurface: '#3D2914',
    onSurfaceVariant: '#6B5344',
    outline: '#8B6914',
    outlineVariant: '#C4A574',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: '#FFFDF5',
      level2: '#FFF9E8',
      level3: '#FFF3D6',
    },
  },
};

export function getAppTheme(mode: ThemeMode): MD3Theme {
  switch (mode) {
    case 'dark':
      return appDarkTheme;
    case 'cartoon':
      return appCartoonTheme;
    default:
      return appLightTheme;
  }
}
