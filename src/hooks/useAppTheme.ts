import { useColorScheme } from 'react-native';
import { resolveThemeMode, type ResolvedTheme } from '../protocol/appSettings';
import { useSettingsStore } from '../store/settingsStore';
import { getThemeDecorations, type ThemeDecorations } from '../theme/decorations';

export interface AppThemeContext {
  /**
   * The theme actually being painted — never the `system` preference. Anything
   * choosing a colour or a corner wants this.
   */
  themeMode: ResolvedTheme;
  decorations: ThemeDecorations;
  isCartoon: boolean;
}

/**
 * Resolve the stored preference against the phone, in one place.
 *
 * `useColorScheme` re-renders on its own when the phone flips to dark, so a
 * screen using this follows along without anyone subscribing to anything.
 */
export function useAppTheme(): AppThemeContext {
  const preference = useSettingsStore((s) => s.themeMode);
  const scheme = useColorScheme();
  const themeMode = resolveThemeMode(preference, scheme);

  return {
    themeMode,
    decorations: getThemeDecorations(themeMode),
    isCartoon: themeMode === 'cartoon',
  };
}
