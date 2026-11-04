import { roundedTopBarPath } from '../src/components/history/roundedTopBar';

describe('roundedTopBarPath', () => {
  it('rounds only the top corners and keeps a flat base', () => {
    expect(roundedTopBarPath(10, 20, 8, 40, 4)).toBe(
      'M10,60 L10,24 Q10,20 14,20 L14,20 Q18,20 18,24 L18,60 Z',
    );
  });

  it('never rounds past half the width', () => {
    // A 6-wide bar can only be 3 round, however much is asked for.
    expect(roundedTopBarPath(0, 0, 6, 30, 10)).toBe(
      'M0,30 L0,3 Q0,0 3,0 L3,0 Q6,0 6,3 L6,30 Z',
    );
  });

  it('never rounds past the height, so a stub stays a stub', () => {
    expect(roundedTopBarPath(0, 10, 8, 2, 4)).toBe(
      'M0,12 L0,12 Q0,10 2,10 L6,10 Q8,10 8,12 L8,12 Z',
    );
  });

  it('draws nothing for a bar with no size', () => {
    expect(roundedTopBarPath(0, 0, 0, 10, 4)).toBe('');
    expect(roundedTopBarPath(0, 0, 8, 0, 4)).toBe('');
  });
});
