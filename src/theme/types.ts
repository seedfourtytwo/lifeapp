import type { ThemeMode } from '../protocol/appSettings';

export { THEME_MODES, isThemeMode, type ThemeMode } from '../protocol/appSettings';

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
