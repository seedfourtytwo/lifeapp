/**
 * A picked compare chip is filled with its series colour and carries the
 * theme's on-primary label, so the chip row doubles as the chart's legend.
 * Every series colour has to hold that label at the body-text floor.
 */
import { seriesChipColors } from '../src/components/history/SeriesChip';
import { getAppPalette } from '../src/theme/palette';
import { appDarkTheme, appLightTheme } from '../src/theme/themes';
import { contrastRatio } from './support/contrast';

describe.each([
  ['light', appLightTheme],
  ['dark', appDarkTheme],
] as const)('%s compare chips', (mode, theme) => {
  it.each(getAppPalette(mode).series.map((c, i) => [i, c] as const))(
    'series %i label clears 4.5:1',
    (_i, color) => {
      const { background, label } = seriesChipColors(theme.colors, { selected: true, color });
      expect(contrastRatio(label, background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('an idle chip sits on the card fill with ink text', () => {
    expect(seriesChipColors(theme.colors, { selected: false })).toEqual({
      background: theme.colors.surface,
      label: theme.colors.onSurface,
    });
  });

  it('a chip past the cap goes to the well with quiet text, not to faded text', () => {
    const { background, label } = seriesChipColors(theme.colors, { selected: false, disabled: true });
    expect(background).toBe(theme.colors.surfaceVariant);
    expect(label).toBe(theme.colors.onSurfaceVariant);
    expect(contrastRatio(label, background)).toBeGreaterThanOrEqual(4.5);
  });
});
