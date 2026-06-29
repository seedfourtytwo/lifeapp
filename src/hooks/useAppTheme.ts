import { useSettingsStore } from '../store/settingsStore';
import { getThemeDecorations, type ThemeDecorations } from '../theme/decorations';
import type { ThemeMode } from '../theme/types';

export interface AppThemeContext {
  themeMode: ThemeMode;
  decorations: ThemeDecorations;
  isCartoon: boolean;
}

export function useAppTheme(): AppThemeContext {
  const themeMode = useSettingsStore((s) => s.themeMode);
  return {
    themeMode,
    decorations: getThemeDecorations(themeMode),
    isCartoon: themeMode === 'cartoon',
  };
}
