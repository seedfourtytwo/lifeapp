import type { ResolvedTheme } from '../protocol/appSettings';
import { getAppPalette } from '../theme/palette';

/** The colour of the `index`th compared series in Insights, for the painted theme. */
export function seriesColorAt(mode: ResolvedTheme, index: number): string {
  const { series } = getAppPalette(mode);
  return series[index % series.length]!;
}
