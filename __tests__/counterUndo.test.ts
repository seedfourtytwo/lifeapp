/**
 * One Undo for a burst of taps on the same counter.
 *
 * Three quick +1s on Water should offer "Water +3 · Undo" and put the total
 * back to where it was before the first tap — not leave two of them behind.
 */
import { nextCounterUndo } from '../src/utils/counterUndo';

const water = { elementId: 'w', name: 'Water' };

describe('counter undo', () => {
  it('remembers the total before a first tap', () => {
    expect(nextCounterUndo(null, { ...water, before: 4, added: 1 })).toEqual({
      ...water,
      restoreTo: 4,
      added: 1,
    });
  });

  it('folds a burst on the same counter into one undo back to the start', () => {
    const first = nextCounterUndo(null, { ...water, before: 4, added: 1 });
    const second = nextCounterUndo(first, { ...water, before: 5, added: 1 });
    const third = nextCounterUndo(second, { ...water, before: 6, added: 5 });
    expect(third).toEqual({ ...water, restoreTo: 4, added: 7 });
  });

  it('starts over when another counter is tapped', () => {
    const first = nextCounterUndo(null, { ...water, before: 4, added: 1 });
    const coffee = nextCounterUndo(first, {
      elementId: 'c',
      name: 'Coffee',
      before: 2,
      added: 1,
    });
    expect(coffee).toEqual({ elementId: 'c', name: 'Coffee', restoreTo: 2, added: 1 });
  });
});
