/**
 * The stored theme preference is not the theme.
 *
 * `themeMode` is what the person chose, and one of those choices is "follow the
 * phone". Everything that paints — Paper's theme, the decorations, the status
 * bar — needs the *resolved* answer instead, which is only ever light, dark, or
 * cartoon. Keeping the two types apart is what stops `getAppTheme('system')`
 * from quietly falling through to light.
 */
import {
  RESOLVED_THEMES,
  THEME_MODES,
  isThemeMode,
  resolveThemeMode,
} from '../src/protocol/appSettings';

describe('theme preference', () => {
  it('offers system alongside the three painted themes', () => {
    expect(THEME_MODES).toEqual(['system', 'light', 'dark', 'cartoon']);
  });

  it('resolves to something paintable, never to the preference itself', () => {
    expect(RESOLVED_THEMES).toEqual(['light', 'dark', 'cartoon']);
    expect(RESOLVED_THEMES).not.toContain('system');
  });

  it('accepts every mode it can store, including older values', () => {
    for (const mode of THEME_MODES) {
      expect(isThemeMode(mode)).toBe(true);
    }
    expect(isThemeMode('midnight')).toBe(false);
  });
});

describe('resolveThemeMode', () => {
  it('follows the phone when set to system', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
  });

  /**
   * `useColorScheme` returns null before the OS answers, and on platforms that
   * do not report one. Light is the safer guess: a light app on a dark phone is
   * a surprise, a dark app on a light phone in daylight is unreadable.
   */
  it('falls back to light when the phone has not said', () => {
    expect(resolveThemeMode('system', null)).toBe('light');
    expect(resolveThemeMode('system', undefined)).toBe('light');
  });

  it('ignores the phone when a theme was chosen explicitly', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('cartoon', 'dark')).toBe('cartoon');
  });
});
