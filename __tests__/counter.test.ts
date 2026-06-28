import { formatCounterUnit } from '../src/protocol/kinds/counter';
import { lerpHex } from '../src/utils/color';

describe('formatCounterUnit', () => {
  it('singularizes and capitalizes for count of 1', () => {
    expect(formatCounterUnit(1, 'reps')).toBe('Rep');
    expect(formatCounterUnit(2, 'reps')).toBe('reps');
  });
});

describe('lerpHex', () => {
  it('interpolates between two colors', () => {
    expect(lerpHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});
