import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/** Fresh teal accent — warmer and more upbeat than the old forest green. */
export const brand = {
  primary: '#0D9488',
  primaryLight: '#2DD4BF',
  error: '#B00020',
} as const;

export const appLightTheme: MD3Theme = {
  ...MD3LightTheme,
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
  },
};

export const appDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
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
  },
};

/** @deprecated Use useTheme() from react-native-paper instead. */
export const colors = {
  primary: brand.primary,
  primaryLight: brand.primaryLight,
  surface: appLightTheme.colors.surface,
  background: appLightTheme.colors.background,
  textMuted: 'rgba(0,0,0,0.6)',
  error: brand.error,
} as const;
