/**
 * One Undo for a burst of taps on the same counter.
 *
 * Three quick +1s on Water should offer "Water +3 · Undo" and take back
 * exactly those three taps — every other entry that day stays as it was.
 */
import { nextCounterUndo } from '../src/utils/counterUndo';

const water = { elementId: 'w', name: 'Water' };

describe('counter undo', () => {
  it('remembers the event a first tap wrote', () => {
    expect(nextCounterUndo(null, { ...water, eventId: 'e1', added: 1 })).toEqual({
      ...water,
      eventIds: ['e1'],
      added: 1,
    });
  });

  it('folds a burst on the same counter into one undo of all its taps', () => {
    const first = nextCounterUndo(null, { ...water, eventId: 'e1', added: 1 });
    const second = nextCounterUndo(first, { ...water, eventId: 'e2', added: 1 });
    const third = nextCounterUndo(second, { ...water, eventId: 'e3', added: 5 });
    expect(third).toEqual({ ...water, eventIds: ['e1', 'e2', 'e3'], added: 7 });
  });

  it('starts over when another counter is tapped', () => {
    const first = nextCounterUndo(null, { ...water, eventId: 'e1', added: 1 });
    const coffee = nextCounterUndo(first, {
      elementId: 'c',
      name: 'Coffee',
      eventId: 'e2',
      added: 1,
    });
    expect(coffee).toEqual({ elementId: 'c', name: 'Coffee', eventIds: ['e2'], added: 1 });
  });
});
