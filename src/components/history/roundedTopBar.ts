/**
 * An SVG path for a chart bar whose top corners are round and whose base sits
 * square on the axis. `Rect rx` rounds all four corners, which lifts every bar
 * off the baseline and makes a month of them read as a row of pills.
 *
 * The radius is clamped to half the width and to the height, so a narrow bar
 * gets a semicircular top and a one-unit stub stays flat rather than bulging.
 */
export function roundedTopBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  if (width <= 0 || height <= 0) return '';
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const right = x + width;
  const base = y + height;
  return [
    `M${x},${base}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${right - r},${y}`,
    `Q${right},${y} ${right},${y + r}`,
    `L${right},${base}`,
    'Z',
  ].join(' ');
}
