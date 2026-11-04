/** WCAG contrast arithmetic shared by the appearance rule tests. */

/** Accepts both `#RRGGBB` and the `rgba(r, g, b, a)` strings MD3 ships. */
export function parseColor(value: string): [number, number, number] {
  const rgba = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];

  const hex = value.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Unsupported colour format: ${value}`);
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** Relative luminance per WCAG 2.1. */
function luminance(color: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = parseColor(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composite `fg` at `alpha` over `bg`, the way `opacity` on a Text renders. */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  const [fr, fgc, fb] = parseColor(fg);
  const [br, bgc, bb] = parseColor(bg);
  const mix = (f: number, b: number) =>
    Math.round(f * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(fr, br)}${mix(fgc, bgc)}${mix(fb, bb)}`;
}
