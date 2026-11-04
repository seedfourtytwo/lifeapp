import { chartAxisTicks, AXIS_LABEL_SLOT } from '../src/utils/chartAxis';
import { formatAxisLabel } from '../src/utils/dates';

describe('chartAxisTicks', () => {
  it('labels every day when each column is wide enough', () => {
    expect(chartAxisTicks(7, 7 * AXIS_LABEL_SLOT)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('thins labels so no two are closer than one slot, always keeping today', () => {
    const n = 30;
    const width = 360; // 12dp a column: the case that crammed "Mon 5" into every one
    const ticks = chartAxisTicks(n, width);
    expect(ticks.at(-1)).toBe(n - 1);
    const colW = width / n;
    for (let i = 1; i < ticks.length; i++) {
      expect((ticks[i]! - ticks[i - 1]!) * colW).toBeGreaterThanOrEqual(AXIS_LABEL_SLOT);
    }
    expect(ticks.length).toBeGreaterThan(3);
  });

  it('returns ascending indices', () => {
    const ticks = chartAxisTicks(90, 360);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
  });

  it('is empty before layout or with no days', () => {
    expect(chartAxisTicks(0, 300)).toEqual([]);
    expect(chartAxisTicks(14, 0)).toEqual([]);
  });

  it('still labels today when a single slot is wider than the chart', () => {
    expect(chartAxisTicks(5, 20)).toEqual([4]);
  });
});

describe('formatAxisLabel', () => {
  it('gives the day of the month alone for dense ranges', () => {
    expect(formatAxisLabel('2026-11-05', 'day')).toBe('5');
  });

  it('gives a short weekday with no day number for a week', () => {
    const label = formatAxisLabel('2026-11-02', 'weekday');
    expect(label).not.toMatch(/\d/);
    expect(label.length).toBeLessThanOrEqual(4);
  });
});
