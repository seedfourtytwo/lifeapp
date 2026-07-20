const BUBBLE_SIZE = 64;
const BUBBLE_HEIGHT = 72;

export { BUBBLE_SIZE, BUBBLE_HEIGHT };

/** Clamp normalized bubble position so the bubble stays on-screen above the dock. */
export function clampBubblePosition(
  xNorm: number,
  yNorm: number,
  layout: { width: number; height: number; topInset: number; bottomInset: number },
): { x: number; y: number } {
  const { width, height, topInset, bottomInset } = layout;
  if (width <= 0 || height <= 0) {
    return { x: Math.min(1, Math.max(0, xNorm)), y: Math.min(1, Math.max(0, yNorm)) };
  }

  const minX = 8;
  const maxX = Math.max(minX, width - BUBBLE_SIZE - 8);
  const minY = topInset + 8;
  const maxY = Math.max(minY, height - bottomInset - BUBBLE_HEIGHT - 8);

  const pixelX = xNorm * width;
  const pixelY = yNorm * height;
  const clampedX = Math.min(maxX, Math.max(minX, pixelX));
  const clampedY = Math.min(maxY, Math.max(minY, pixelY));

  return {
    x: width > 0 ? clampedX / width : 0,
    y: height > 0 ? clampedY / height : 0,
  };
}

export function defaultBubblePosition(): { x: number; y: number } {
  return { x: 0.78, y: 0.12 };
}
