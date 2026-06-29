import { StyleSheet } from 'react-native';
import type { ThemeMode } from './types';

/** Border widths, corner radii, and sizes that vary by theme. */
export interface ThemeDecorations {
  borderWidth: number;
  cardBorderWidth: number;
  radius: { sm: number; md: number; lg: number };
  tabRadius: number;
  progressHeight: number;
  buttonRadius: number;
  headerBorderWidth: number;
}

const LIGHT_DECORATIONS: ThemeDecorations = {
  borderWidth: 1,
  cardBorderWidth: 1,
  radius: { sm: 8, md: 12, lg: 16 },
  tabRadius: 12,
  progressHeight: 3,
  buttonRadius: 8,
  headerBorderWidth: StyleSheet.hairlineWidth,
};

const CARTOON_DECORATIONS: ThemeDecorations = {
  borderWidth: 2,
  cardBorderWidth: 3,
  radius: { sm: 14, md: 18, lg: 22 },
  tabRadius: 18,
  progressHeight: 8,
  buttonRadius: 14,
  headerBorderWidth: 3,
};

export function getThemeDecorations(mode: ThemeMode): ThemeDecorations {
  return mode === 'cartoon' ? CARTOON_DECORATIONS : LIGHT_DECORATIONS;
}
