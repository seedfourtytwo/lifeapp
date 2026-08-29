import type { ThemeMode } from '../protocol/appSettings';

export { THEME_MODES, isThemeMode, type ThemeMode } from '../protocol/appSettings';

export interface ThemeModeOption {
  value: ThemeMode;
  labelKey:
    | 'appearance.themeSystem'
    | 'appearance.themeLight'
    | 'appearance.themeDark'
    | 'appearance.themeCartoon';
  icon: string;
}

export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  {
    value: 'system',
    labelKey: 'appearance.themeSystem',
    icon: 'cellphone',
  },
  {
    value: 'light',
    labelKey: 'appearance.themeLight',
    icon: 'white-balance-sunny',
  },
  {
    value: 'dark',
    labelKey: 'appearance.themeDark',
    icon: 'weather-night',
  },
  {
    value: 'cartoon',
    labelKey: 'appearance.themeCartoon',
    icon: 'gamepad-variant-outline',
  },
];

export const APP_LANGUAGE_OPTIONS = [
  {
    value: 'system' as const,
    labelKey: 'appearance.languageSystem' as const,
    icon: 'cellphone' as const,
  },
  {
    value: 'en' as const,
    labelKey: 'appearance.languageEn' as const,
    icon: 'translate' as const,
  },
  {
    value: 'fr' as const,
    labelKey: 'appearance.languageFr' as const,
    icon: 'translate' as const,
  },
];
