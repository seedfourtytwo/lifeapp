import { dueChipDates, matchDueChip } from '../src/screens/todos/dueChips';

// 2026-11-04 is a Wednesday.
const WED = '2026-11-04';

describe('dueChipDates', () => {
  it('offers today, tomorrow, the coming Saturday and next Monday', () => {
    expect(dueChipDates(WED)).toEqual({
      today: '2026-11-04',
      tomorrow: '2026-11-05',
      weekend: '2026-11-07',
      nextWeek: '2026-11-09',
    });
  });

  it('treats Saturday and Sunday as already the weekend', () => {
    expect(dueChipDates('2026-11-07').weekend).toBe('2026-11-07');
    expect(dueChipDates('2026-11-08').weekend).toBe('2026-11-08');
  });

  it('puts next week a full week out on a Monday', () => {
    expect(dueChipDates('2026-11-09').nextWeek).toBe('2026-11-16');
  });

  it('crosses month and year ends', () => {
    expect(dueChipDates('2026-12-31')).toEqual({
      today: '2026-12-31',
      tomorrow: '2027-01-01',
      weekend: '2027-01-02',
      nextWeek: '2027-01-04',
    });
  });
});

describe('matchDueChip', () => {
  it('names the chip a saved deadline matches, first match wins', () => {
    expect(matchDueChip(null, WED)).toBe('none');
    expect(matchDueChip('2026-11-04', WED)).toBe('today');
    expect(matchDueChip('2026-11-05', WED)).toBe('tomorrow');
    expect(matchDueChip('2026-11-07', WED)).toBe('weekend');
    expect(matchDueChip('2026-11-09', WED)).toBe('nextWeek');
  });

  it('prefers Tomorrow over Weekend on a Friday', () => {
    expect(matchDueChip('2026-11-07', '2026-11-06')).toBe('tomorrow');
  });

  it('calls anything else a custom day', () => {
    expect(matchDueChip('2026-12-25', WED)).toBe('custom');
    expect(matchDueChip('2026-11-01', WED)).toBe('custom');
  });
});
