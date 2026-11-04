/**
 * A hairline (`StyleSheet.hairlineWidth`, ~0.38dp on a modern phone) renders
 * as a grey haze rather than an edge. Light and dark separate a card from the
 * page by fill — a page one step darker than the card — and only cartoon keeps
 * its drawn outline, which is that theme's whole idea.
 */
import { getThemeDecorations } from '../src/theme/decorations';
import { appDarkTheme, appLightTheme } from '../src/theme/themes';
import { contrastRatio } from './support/contrast';

describe.each(['light', 'dark', 'cartoon'] as const)('%s decorations', (mode) => {
  const deco = getThemeDecorations(mode);
  it.each([
    ['borderWidth', deco.borderWidth],
    ['cardBorderWidth', deco.cardBorderWidth],
    ['headerBorderWidth', deco.headerBorderWidth],
  ])('%s is either nothing or a drawn stroke', (_key, width) => {
    expect(width === 0 || width >= 1).toBe(true);
  });
});

describe.each([
  ['light', appLightTheme],
  ['dark', appDarkTheme],
] as const)('%s cards', (mode, theme) => {
  it('have no outline', () => {
    expect(getThemeDecorations(mode).cardBorderWidth).toBe(0);
    expect(getThemeDecorations(mode).headerBorderWidth).toBe(0);
  });
  it('stand off the page by fill alone', () => {
    // Visible but quiet: one step, not a frame.
    const step = contrastRatio(theme.colors.surface, theme.colors.background);
    expect(step).toBeGreaterThanOrEqual(1.08);
    expect(step).toBeLessThan(1.6);
  });
});

// The decorations above cover the theme; this covers every component that
// reaches past it. A hairline anywhere is the same grey haze.
describe('source', () => {
  const { readdirSync, readFileSync, statSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
  const { join } = jest.requireActual<typeof import('node:path')>('node:path');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return /\.tsx?$/.test(name) ? [path] : [];
    });

  it('never draws StyleSheet.hairlineWidth', () => {
    const offenders = walk(join(__dirname, '../src')).filter((file) =>
      /:\s*StyleSheet\.hairlineWidth/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  // Paper's Divider is StyleSheet.hairlineWidth tall: the same haze by another name.
  it("never renders Paper's Divider", () => {
    const offenders = walk(join(__dirname, '../src')).filter((file) =>
      /<Divider\b/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
