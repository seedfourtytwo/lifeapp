/**
 * Where Review draws things: the ledger's shared day columns with a wider gap
 * before each Monday, year bars, the labels over them, and the history
 * screen's heatmap and strength line.
 */
import { heatmapLayout, heatmapMonthMarks } from '../src/components/history/heatmapLayout';
import { strengthLinePoints } from '../src/components/history/strengthLinePoints';
import { reviewWindowDates, yearHeatmap } from '../src/review';
import {
  barHeight,
  barSlots,
  CELL_GAP,
  dayStripSlots,
  ledgerColumns,
  mondayHeaderMarks,
  monthDaysShown,
  monthHeaderMarks,
  nameColumnWidth,
  strengthColumnWidth,
  WEEK_GAP,
  weekHeaderMarks,
} from '../src/screens/review/reviewGeometry';

/** A Wednesday. */
const TODAY = '2026-11-18';

describe('nameColumnWidth', () => {
  it('is 92 on a phone and grows with the tile up to 180', () => {
    expect(nameColumnWidth(303)).toBe(92);
    expect(nameColumnWidth(700)).toBeCloseTo(126);
    expect(nameColumnWidth(1008)).toBe(180);
  });
});

describe('strengthColumnWidth', () => {
  it('gives strength its own column only on a wide window', () => {
    expect(strengthColumnWidth(375)).toBe(0);
    expect(strengthColumnWidth(719)).toBe(0);
    expect(strengthColumnWidth(720)).toBe(80);
    expect(strengthColumnWidth(1200)).toBe(80);
  });
});

describe('dayStripSlots', () => {
  it('fills the width with equal cells', () => {
    // Thu → Wed: one Monday inside, so one wider gap.
    const slots = dayStripSlots(reviewWindowDates(TODAY, 7), 211);
    expect(slots).toHaveLength(7);
    expect(slots[0].x).toBe(0);
    expect(slots[0].width).toBeCloseTo((211 - 6 * CELL_GAP - WEEK_GAP) / 7);
    expect(slots[6].x + slots[6].width).toBeCloseTo(211);
  });

  it('opens a wider gap before each Monday', () => {
    const dates = reviewWindowDates(TODAY, 28);
    const slots = dayStripSlots(dates, 211);
    const gaps = slots.slice(1).map((slot, i) => slot.x - (slots[i].x + slots[i].width));
    dates.slice(1).forEach((date, i) => {
      const monday = new Date(`${date}T12:00:00`).getDay() === 1;
      expect(gaps[i]).toBeCloseTo(monday ? CELL_GAP + WEEK_GAP : CELL_GAP);
    });
    expect(gaps.filter((gap) => gap > 3)).toHaveLength(4);
    expect(slots[27].x + slots[27].width).toBeCloseTo(211);
  });

  it('gives a first cell that is a Monday no leading gap', () => {
    const slots = dayStripSlots(['2026-11-16', '2026-11-17'], 100);
    expect(slots[0].x).toBe(0);
    expect(slots[1].x - slots[0].width).toBeCloseTo(CELL_GAP);
  });

  it('draws nothing without dates or width', () => {
    expect(dayStripSlots([], 211)).toEqual([]);
    expect(dayStripSlots(reviewWindowDates(TODAY, 7), 0)).toEqual([]);
  });
});

describe('monthDaysShown', () => {
  const month = reviewWindowDates(TODAY, 30);

  it('draws the last 28 days when 30 would make cells narrower than 5', () => {
    expect(dayStripSlots(month, 211)[0].width).toBeLessThan(5);
    expect(monthDaysShown(month, 211)).toBe(28);
    expect(dayStripSlots(month.slice(-28), 211)[0].width).toBeGreaterThanOrEqual(5);
  });

  it('draws all 30 once they fit', () => {
    expect(monthDaysShown(month, 240)).toBe(30);
    expect(monthDaysShown(month, 828)).toBe(30);
  });
});

describe('year bars', () => {
  it('fills the width with equal bars', () => {
    const slots = barSlots(53, 211);
    expect(slots).toHaveLength(53);
    expect(slots[52].x + slots[52].width).toBeCloseTo(211);
    expect(barSlots(0, 211)).toEqual([]);
  });

  it('scales height by share between a floor and the full height', () => {
    expect(barHeight(1, 3, 20)).toBe(20);
    expect(barHeight(0.5, 3, 20)).toBe(11.5);
    expect(barHeight(0.01, 3, 20)).toBeGreaterThanOrEqual(3);
    expect(barHeight(2, 3, 20)).toBe(20);
  });
});

describe('header marks', () => {
  it('puts a week’s marks exactly over its cells', () => {
    const dates = reviewWindowDates(TODAY, 7);
    const slots = dayStripSlots(dates, 211);
    expect(weekHeaderMarks(dates, slots)).toEqual(
      slots.map((slot, i) => ({ date: dates[i], x: slot.x, width: slot.width })),
    );
  });

  it('marks each Monday of a month, each running to the next', () => {
    const dates = reviewWindowDates(TODAY, 28);
    const slots = dayStripSlots(dates, 211);
    const marks = mondayHeaderMarks(dates, slots, 211);
    expect(marks.map((mark) => mark.date)).toEqual([
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ]);
    expect(marks[0].x).toBe(slots[4].x);
    expect(marks[0].x + marks[0].width).toBeCloseTo(marks[1].x);
    expect(marks[3].x + marks[3].width).toBeCloseTo(211);
  });

  it('marks a year’s months at the week of their first Monday', () => {
    const weekStarts = yearHeatmap([], TODAY).map((column) => column.weekStart);
    const slots = barSlots(weekStarts.length, 211);
    const marks = monthHeaderMarks(weekStarts, slots, 211);
    expect(marks.length).toBeGreaterThanOrEqual(12);
    expect(marks[marks.length - 1].date).toBe('2026-11-02');
    expect(marks[marks.length - 1].x).toBe(slots[50].x);
    marks.forEach((mark) => expect(mark.width).toBeGreaterThan(0));
  });
});

describe('ledgerColumns', () => {
  it('draws a week as seven days, each with a mark', () => {
    const columns = ledgerColumns('week', TODAY, 211);
    expect(columns.dates).toEqual(reviewWindowDates(TODAY, 7));
    expect(columns.slots).toHaveLength(7);
    expect(columns.marks).toHaveLength(7);
  });

  it('draws a month as its last 28 days on a phone and all 30 with room', () => {
    const narrow = ledgerColumns('month', TODAY, 211);
    expect(narrow.dates).toEqual(reviewWindowDates(TODAY, 28));
    expect(narrow.marks).toHaveLength(4);
    expect(ledgerColumns('month', TODAY, 828).dates).toEqual(reviewWindowDates(TODAY, 30));
  });

  it('draws a year as 53 weeks, marked by month', () => {
    const columns = ledgerColumns('year', TODAY, 211);
    expect(columns.dates).toEqual([]);
    expect(columns.slots).toHaveLength(53);
    expect(columns.marks.length).toBeGreaterThanOrEqual(12);
  });

  it('has no columns before it has a width', () => {
    expect(ledgerColumns('month', TODAY, 0).slots).toEqual([]);
    expect(ledgerColumns('year', TODAY, 0).marks).toEqual([]);
  });
});

describe('heatmapLayout', () => {
  it('keeps the smallest legible cell on a phone and runs wider than the tile', () => {
    const layout = heatmapLayout(53, 295);
    expect(layout.cell).toBe(5);
    expect(layout.width).toBe(53 * 7 - 2);
    expect(layout.width).toBeGreaterThan(295);
    expect(layout.height).toBe(7 * 7 - 2);
  });

  it('fills the width on a wide screen, up to a ceiling', () => {
    const fitted = heatmapLayout(53, 700);
    expect(fitted.width).toBeCloseTo(700);
    expect(heatmapLayout(53, 2000).cell).toBe(16);
  });
});

describe('heatmapMonthMarks', () => {
  it('marks the column of each month’s first Monday, once per month', () => {
    const marks = heatmapMonthMarks(yearHeatmap([], TODAY));
    expect(marks.length).toBeGreaterThanOrEqual(12);
    expect(marks.length).toBeLessThanOrEqual(13);
    expect(marks[marks.length - 1]).toEqual({ column: 50, weekStart: '2026-11-02' });
    marks.slice(1).forEach((mark, i) => {
      expect(mark.column - marks[i].column).toBeGreaterThanOrEqual(4);
      expect(mark.weekStart.slice(0, 7)).not.toBe(marks[i].weekStart.slice(0, 7));
    });
  });
});

describe('strengthLinePoints', () => {
  it('spans the plot and ends at the right edge', () => {
    const points = strengthLinePoints(
      Array.from({ length: 90 }, (_, i) => i),
      90,
      200,
      50,
      4,
    );
    expect(points).toHaveLength(90);
    expect(points[0].x).toBe(4);
    expect(points[89].x).toBeCloseTo(196);
    // Score 0 sits on the baseline, 100 at the top.
    expect(points[0].y).toBe(46);
    expect(strengthLinePoints([100], 90, 200, 50, 4)[0].y).toBe(4);
  });

  it('starts a young tracker part-way across rather than stretching it', () => {
    const points = strengthLinePoints([10, 20, 30], 90, 200, 50, 4);
    expect(points).toHaveLength(3);
    expect(points[2].x).toBeCloseTo(196);
    expect(points[0].x).toBeGreaterThan(180);
  });

  it('keeps only the latest slots of a longer series', () => {
    const points = strengthLinePoints(
      Array.from({ length: 400 }, () => 50),
      90,
      200,
      50,
      4,
    );
    expect(points).toHaveLength(90);
    expect(points[0].x).toBe(4);
  });
});
