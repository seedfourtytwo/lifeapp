import { parseLocalDate, shiftDateString, toDateString } from '../src/protocol';

describe('parseLocalDate', () => {
  it('parses a calendar date at local noon', () => {
    const d = parseLocalDate('2026-03-29');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(12);
  });

  it('round-trips through toDateString', () => {
    for (const date of ['2024-02-29', '2025-01-01', '2025-12-31', '2026-03-29']) {
      expect(toDateString(parseLocalDate(date))).toBe(date);
    }
  });
});

describe('shiftDateString', () => {
  it('walks forward and backward', () => {
    expect(shiftDateString('2025-01-01', 1)).toBe('2025-01-02');
    expect(shiftDateString('2025-01-01', -1)).toBe('2024-12-31');
    expect(shiftDateString('2025-01-01', 0)).toBe('2025-01-01');
  });

  it('crosses month and leap-year boundaries', () => {
    expect(shiftDateString('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDateString('2024-02-29', 1)).toBe('2024-03-01');
    expect(shiftDateString('2025-02-28', 1)).toBe('2025-03-01');
    expect(shiftDateString('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('survives a multi-day walk across a DST spring-forward window', () => {
    // Local noon anchoring means every step lands on the next calendar day
    // even when one of them is a 23-hour day.
    let cursor = '2025-03-28';
    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      cursor = shiftDateString(cursor, 1);
      seen.push(cursor);
    }
    expect(seen).toEqual([
      '2025-03-29',
      '2025-03-30',
      '2025-03-31',
      '2025-04-01',
      '2025-04-02',
    ]);
  });
});
