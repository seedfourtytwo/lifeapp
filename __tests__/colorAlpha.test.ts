/**
 * A translucent wash is built from whatever colour the theme hands over. The
 * app's own themes use `#RRGGBB`, but Paper's default theme (which some
 * component tests render under) uses `rgba(...)`, and gluing a hex alpha onto
 * that produced `rgba(28, 27, 31, 1)14`, which React Native cannot parse.
 */
import { withAlpha } from '../src/utils/color';

describe('withAlpha', () => {
  it('appends alpha to a six-digit hex', () => {
    expect(withAlpha('#18201C', 0.08)).toBe('#18201C14');
  });

  it('expands a three-digit hex first', () => {
    expect(withAlpha('#abc', 0.5)).toBe('#aabbcc80');
  });

  it('replaces the alpha an eight-digit hex already has', () => {
    expect(withAlpha('#18201CFF', 0.08)).toBe('#18201C14');
  });

  it('rewrites rgba and rgb into rgba with the new alpha', () => {
    expect(withAlpha('rgba(28, 27, 31, 1)', 0.08)).toBe('rgba(28, 27, 31, 0.08)');
    expect(withAlpha('rgb(28,27,31)', 0.5)).toBe('rgba(28, 27, 31, 0.5)');
  });

  it('clamps the alpha and leaves a colour it cannot read alone', () => {
    expect(withAlpha('#000000', 2)).toBe('#000000ff');
    expect(withAlpha('transparent', 0.5)).toBe('transparent');
  });
});
