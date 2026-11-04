/**
 * Paper ships Material's purple seed under every colour we do not set — the
 * elevation ramp, inverse colours, disabled washes. Any of them leaking through
 * paints one control lavender in an app that has no lavender (the search bar
 * did, through `elevation.level3`). Every colour a theme carries is checked.
 */
import { appDarkTheme, appLightTheme } from '../src/theme/themes';

function rgbOf(value: string): [number, number, number] | null {
  const rgba = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  const hex = value.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** True for a colour a person would call purple, violet or lavender. */
function isPurple([r, g, b]: [number, number, number]): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return false;
  const l = (max + min) / 2 / 255;
  const d = (max - min) / 255;
  const s = l > 0.5 ? d / (2 - 2 * l) : d / (2 * l);
  let h: number;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  const hue = (h * 60 + 360) % 360;
  return hue >= 250 && hue <= 330 && s >= 0.15;
}

function flatten(obj: object, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : typeof value === 'object' && value !== null
        ? flatten(value as object, `${prefix}${key}.`)
        : [],
  );
}

describe.each([
  ['light', appLightTheme],
  ['dark', appDarkTheme],
] as const)('%s theme', (_name, theme) => {
  it.each(flatten(theme.colors))('%s is not Material purple', (_key, value) => {
    const rgb = rgbOf(value);
    if (value !== 'transparent') expect(rgb).not.toBeNull();
    if (rgb) expect(isPurple(rgb)).toBe(false);
  });
});
