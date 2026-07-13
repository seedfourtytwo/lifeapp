import type { ThemeMode } from '../theme/types';
import { getCounterProgressPalette, lerpHex } from './color';

type ProgressCardStyleInput = {
  themeMode: ThemeMode;
  progress: number;
  hasTarget: boolean;
  isCartoon: boolean;
  fallbackColor?: string;
};

/** Background tint for counter/timer cards with a daily target progress bar. */
export function getTargetProgressCardBackground({
  themeMode,
  progress,
  hasTarget,
  isCartoon,
  fallbackColor,
}: ProgressCardStyleInput): string | undefined {
  if (!hasTarget) {
    return isCartoon ? fallbackColor : undefined;
  }
  const palette = getCounterProgressPalette(themeMode);
  return lerpHex(palette.start, palette.end, progress);
}
