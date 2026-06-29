export const THEME_MODES = ['light', 'dark', 'cartoon'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

export interface ThemeModeOption {
  value: ThemeMode;
  label: string;
  description: string;
  icon: string;
}

export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Clean and minimal',
    icon: 'white-balance-sunny',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easier on the eyes at night',
    icon: 'weather-night',
  },
  {
    value: 'cartoon',
    label: 'Cartoon',
    description: 'Warm colors and rounded panels',
    icon: 'gamepad-variant-outline',
  },
];
