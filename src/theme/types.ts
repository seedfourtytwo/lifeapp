import type { ThemeMode } from '../protocol/appSettings';

export { THEME_MODES, isThemeMode, type ThemeMode } from '../protocol/appSettings';

export interface ThemeModeOption {
  value: ThemeMode;
  labelKey: 'appearance.themeLight' | 'appearance.themeDark' | 'appearance.themeCartoon';
  descriptionKey:
    | 'appearance.themeLightDesc'
    | 'appearance.themeDarkDesc'
    | 'appearance.themeCartoonDesc';
  icon: string;
}

export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  {
    value: 'light',
    labelKey: 'appearance.themeLight',
    descriptionKey: 'appearance.themeLightDesc',
    icon: 'white-balance-sunny',
  },
  {
    value: 'dark',
    labelKey: 'appearance.themeDark',
    descriptionKey: 'appearance.themeDarkDesc',
    icon: 'weather-night',
  },
  {
    value: 'cartoon',
    labelKey: 'appearance.themeCartoon',
    descriptionKey: 'appearance.themeCartoonDesc',
    icon: 'gamepad-variant-outline',
  },
];

export const APP_LANGUAGE_OPTIONS = [
  {
    value: 'system' as const,
    labelKey: 'appearance.languageSystem' as const,
    descriptionKey: 'appearance.languageSystemDesc' as const,
    icon: 'cellphone',
  },
  {
    value: 'en' as const,
    labelKey: 'appearance.languageEn' as const,
    descriptionKey: 'appearance.languageEnDesc' as const,
    icon: 'translate',
  },
  {
    value: 'fr' as const,
    labelKey: 'appearance.languageFr' as const,
    descriptionKey: 'appearance.languageFrDesc' as const,
    icon: 'translate',
  },
];
