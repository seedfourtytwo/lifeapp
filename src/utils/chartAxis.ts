/**
 * Room one axis label needs. Below this a column cannot hold even "28" at the
 * label size, which is how a month view ended up with "Mon 5" squeezed into
 * every 12dp column.
 */
export const AXIS_LABEL_SLOT = 40;

/**
 * Which day columns get an axis label, oldest first. Every column when they
 * are wide enough; otherwise every k-th, counted back from today so the most
 * recent day is always named.
 */
export function chartAxisTicks(dayCount: number, width: number): number[] {
  if (dayCount <= 0 || width <= 0) return [];
  const colW = width / dayCount;
  const stride = Math.max(1, Math.ceil(AXIS_LABEL_SLOT / colW));
  const ticks: number[] = [];
  for (let i = dayCount - 1; i >= 0; i -= stride) ticks.unshift(i);
  return ticks;
}
