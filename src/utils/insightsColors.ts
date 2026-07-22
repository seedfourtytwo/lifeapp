/** Distinct series colors for Insights multi-compare (teal-forward, readable on light). */
export const INSIGHTS_SERIES_COLORS = [
  '#0D9488', // brand teal
  '#2563EB', // blue
  '#D97706', // amber
  '#DB2777', // pink
  '#7C3AED', // violet
] as const;

export function seriesColorAt(index: number): string {
  return INSIGHTS_SERIES_COLORS[index % INSIGHTS_SERIES_COLORS.length]!;
}
