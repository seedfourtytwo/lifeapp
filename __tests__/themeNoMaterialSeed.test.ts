/**
 * Paper ships Material's purple seed under every colour we do not set — the
 * elevation ramp, inverse colours, disabled washes. The app's own ramp is plum
 * on purpose, so purple alone proves nothing; what must not happen is a role
 * left at the value Paper ships for it. One leaking through paints a control
 * in Material's lavender beside the app's plum (the search bar did, through
 * `elevation.level3`). Every colour a theme carries is compared with Paper's
 * default for the same key.
 */
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { appDarkTheme, appLightTheme } from '../src/theme/themes';

type Rgba = [number, number, number, number];

function rgbaOf(value: string): Rgba | null {
  const rgba = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4] ?? 1)];
  const hex = value.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [...[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)), 1] as Rgba;
}

/** True for a colour a person would call purple, violet or lavender. */
function isPurple([r, g, b]: Rgba): boolean {
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
  ['light', appLightTheme, MD3LightTheme],
  ['dark', appDarkTheme, MD3DarkTheme],
] as const)('%s theme', (_name, theme, material) => {
  const seeds = new Map(flatten(material.colors));

  it('is checked against a Material theme that really is purple', () => {
    const purple = [...seeds.values()].filter((value) => {
      const rgba = rgbaOf(value);
      return rgba !== null && isPurple(rgba);
    });
    expect(purple.length).toBeGreaterThanOrEqual(5);
  });

  it.each(flatten(theme.colors))('%s is not left at Material purple', (key, value) => {
    const rgba = rgbaOf(value);
    if (value !== 'transparent') expect(rgba).not.toBeNull();
    const seed = rgbaOf(seeds.get(key) ?? '');
    if (rgba && seed && isPurple(seed)) expect(rgba).not.toEqual(seed);
  });
});
