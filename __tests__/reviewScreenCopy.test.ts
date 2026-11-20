/**
 * What Review says in words: the statement it opens on, and how the figure in
 * it is picked out.
 */
import type { ReviewSummary } from '../src/review';
import {
  emphasisParts,
  percentOf,
  reviewStatement,
} from '../src/screens/review/reviewCopy';

const summary = (over: Partial<ReviewSummary> = {}): ReviewSummary => ({
  current: { done: 62, due: 80, rate: 62 / 80 },
  previous: { done: 57, due: 80, rate: 57 / 80 },
  comparison: 'up',
  perfect: false,
  ...over,
});
const NOTHING_DUE = { done: 0, due: 0, rate: null };
const PERFECT = summary({ current: { done: 80, due: 80, rate: 1 }, perfect: true });

describe('percentOf', () => {
  it('rounds a rate to a whole percentage', () => {
    expect(percentOf(62 / 80)).toBe(78);
    expect(percentOf(0.005)).toBe(1);
    expect(percentOf(1)).toBe(100);
  });
});

describe('reviewStatement', () => {
  it.each(['up', 'down', 'same'] as const)('says the share done, %s on the window before', (comparison) => {
    expect(reviewStatement(summary({ comparison }), 'month')).toEqual({
      key: `statement.${comparison}.month`,
      params: { percent: 78, previous: 71 },
    });
  });

  it.each(['up', 'down'] as const)(
    'says about the same when both round to the same percentage, though the rates went %s',
    (comparison) => {
      const close = summary({
        current: { done: 784, due: 1000, rate: 0.784 },
        previous: { done: 776, due: 1000, rate: 0.776 },
        comparison,
      });
      expect(reviewStatement(close, 'month')).toEqual({
        key: 'statement.same.month',
        params: { percent: 78, previous: 78 },
      });
    },
  );

  it('names the range it compares with', () => {
    expect(reviewStatement(summary(), 'week').key).toBe('statement.up.week');
    expect(reviewStatement(summary(), 'year').key).toBe('statement.up.year');
  });

  it('says the share alone when there is nothing fair to compare with', () => {
    expect(reviewStatement(summary({ comparison: 'none' }), 'year')).toEqual({
      key: 'statement.plain.year',
      params: { percent: 78 },
    });
  });

  it('says everything was done, without a figure, when the range is perfect', () => {
    expect(reviewStatement(PERFECT, 'week')).toEqual({ key: 'statement.perfect.week' });
  });

  it('says nothing was planned when nothing was due', () => {
    expect(reviewStatement(summary({ current: NOTHING_DUE, comparison: 'none' }), 'month')).toEqual({
      key: 'statement.nothing.month',
    });
  });
});

describe('emphasisParts', () => {
  it('picks out the marked figures of a sentence', () => {
    expect(emphasisParts('You did <b>78%</b> of what you planned.')).toEqual([
      { text: 'You did ', strong: false },
      { text: '78%', strong: true },
      { text: ' of what you planned.', strong: false },
    ]);
  });

  it('leaves an unmarked sentence whole', () => {
    expect(emphasisParts('Nothing was planned this month.')).toEqual([
      { text: 'Nothing was planned this month.', strong: false },
    ]);
  });

  it('handles a figure at the very start', () => {
    expect(emphasisParts('<b>78 %</b> de fait.')).toEqual([
      { text: '78 %', strong: true },
      { text: ' de fait.', strong: false },
    ]);
  });
});
