export interface LinePoint {
  x: number;
  y: number;
}

/**
 * Scores (0–100, oldest first) as points in a `width` × `height` plot that
 * always spans `slots` days and ends at the right edge — so a tracker younger
 * than the window starts part-way across instead of being stretched to fill
 * it. `inset` keeps the stroke and the end dot inside the box.
 */
export function strengthLinePoints(
  scores: readonly number[],
  slots: number,
  width: number,
  height: number,
  inset: number,
): LinePoint[] {
  if (slots < 2 || width <= 0 || height <= 0) return [];
  const shown = scores.slice(-slots);
  const stepX = (width - inset * 2) / (slots - 1);
  const plotHeight = height - inset * 2;
  const firstSlot = slots - shown.length;
  return shown.map((score, index) => ({
    x: inset + (firstSlot + index) * stepX,
    y: inset + plotHeight * (1 - Math.min(100, Math.max(0, score)) / 100),
  }));
}
