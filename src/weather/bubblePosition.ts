import { DOCK_RESERVE, EDGE_PAD } from '../ui/homeInsets';
import { clamp01 } from '../utils/clamp01';

/** Collapsed weather chip — rounded box (not a circle). */
const BUBBLE_WIDTH = 112;
const BUBBLE_HEIGHT = 72;
const BUBBLE_RADIUS = 18;

/** Expanded forecast strip. */
const STRIP_DAY_WIDTH = 52;
const STRIP_HEIGHT = 100;
const STRIP_PAD_H = 6;
const STRIP_GAP = 8;
const EXPAND_DAY_COUNT = 4;

export {
  BUBBLE_WIDTH,
  BUBBLE_HEIGHT,
  BUBBLE_RADIUS,
  STRIP_DAY_WIDTH,
  STRIP_HEIGHT,
  STRIP_PAD_H,
  STRIP_GAP,
  EXPAND_DAY_COUNT,
  EDGE_PAD,
  DOCK_RESERVE,
};

export function forecastStripWidth(dayCount: number): number {
  return dayCount * STRIP_DAY_WIDTH + STRIP_PAD_H * 2;
}

export interface BubbleLayout {
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
}

export interface BubbleChipSize {
  width: number;
  height: number;
}

const DEFAULT_CHIP: BubbleChipSize = {
  width: BUBBLE_WIDTH,
  height: BUBBLE_HEIGHT,
};

/** Pixel bounds for the chip top-left corner. */
export function getBubblePixelBounds(
  layout: BubbleLayout,
  chip: BubbleChipSize = DEFAULT_CHIP,
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const { width, height, topInset, bottomInset } = layout;
  const minX = EDGE_PAD;
  const maxX = Math.max(minX, width - chip.width - EDGE_PAD);
  const minY = topInset + EDGE_PAD;
  const maxY = Math.max(minY, height - bottomInset - chip.height - EDGE_PAD);
  return { minX, maxX, minY, maxY };
}

/** Clamp normalized chip position so it stays on-screen above the dock. */
export function clampBubblePosition(
  xNorm: number,
  yNorm: number,
  layout: BubbleLayout,
  chip: BubbleChipSize = DEFAULT_CHIP,
): { x: number; y: number } {
  const { width, height } = layout;
  if (width <= 0 || height <= 0) {
    return { x: clamp01(xNorm), y: clamp01(yNorm) };
  }

  const bounds = getBubblePixelBounds(layout, chip);
  const clampedX = Math.min(bounds.maxX, Math.max(bounds.minX, xNorm * width));
  const clampedY = Math.min(bounds.maxY, Math.max(bounds.minY, yNorm * height));

  return {
    x: clampedX / width,
    y: clampedY / height,
  };
}

export function defaultBubblePosition(): { x: number; y: number } {
  return { x: 0.74, y: 0.12 };
}
