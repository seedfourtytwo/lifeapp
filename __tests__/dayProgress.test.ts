/**
 * The progress line under Today's date: one segment per item due, the done
 * ones filled. It draws the figures `buildTodayModel` counts, so the page and
 * the widget show the same day; only the shape of the bar is decided here.
 */
import { MAX_PROGRESS_SEGMENTS, dayProgress } from '../src/screens/shared/dayProgress';

describe('dayProgress', () => {
  it('draws nothing when nothing is due', () => {
    expect(dayProgress(0, 0)).toBeNull();
  });

  it('draws nothing for a count that is not one', () => {
    expect(dayProgress(1, -2)).toBeNull();
    expect(dayProgress(1, Number.NaN)).toBeNull();
  });

  it('gives one segment per item due, the done ones first', () => {
    expect(dayProgress(3, 11)).toEqual({ shape: 'segments', done: 3, due: 11 });
  });

  it('keeps an untouched day as segments, none filled', () => {
    expect(dayProgress(0, 4)).toEqual({ shape: 'segments', done: 0, due: 4 });
  });

  it('fills every segment when all is done', () => {
    expect(dayProgress(5, 5)).toEqual({ shape: 'segments', done: 5, due: 5 });
  });

  it('never counts more done than due', () => {
    expect(dayProgress(7, 5)).toEqual({ shape: 'segments', done: 5, due: 5 });
    expect(dayProgress(-1, 5)).toEqual({ shape: 'segments', done: 0, due: 5 });
  });

  it('stays segmented up to the limit', () => {
    expect(dayProgress(2, MAX_PROGRESS_SEGMENTS)).toEqual({
      shape: 'segments',
      done: 2,
      due: MAX_PROGRESS_SEGMENTS,
    });
  });

  it('becomes one continuous bar past the limit, where segments would be slivers', () => {
    expect(dayProgress(10, MAX_PROGRESS_SEGMENTS + 1)).toEqual({
      shape: 'bar',
      done: 10,
      due: MAX_PROGRESS_SEGMENTS + 1,
    });
  });
});
