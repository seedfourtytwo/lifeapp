import { habitHeaderMeta, counterHeaderMeta } from '../src/screens/shared/dayHeaderMeta';

describe('habitHeaderMeta', () => {
  it('says nothing is due when the list is empty', () => {
    expect(habitHeaderMeta({ due: 0, done: 0, bestStreak: 9 })).toEqual({
      lead: 'Nothing due',
      trail: null,
    });
  });

  it('puts the count on the left and the run on the right, no separator', () => {
    expect(habitHeaderMeta({ due: 6, done: 2, bestStreak: 13 })).toEqual({
      lead: '2 of 6 done',
      trail: '13 days in a row',
    });
  });

  it('drops the run when there is none', () => {
    expect(habitHeaderMeta({ due: 3, done: 0, bestStreak: 0 }).trail).toBeNull();
  });

  it('uses the singular for a one-day run', () => {
    expect(habitHeaderMeta({ due: 1, done: 1, bestStreak: 1 }).trail).toBe('1 day in a row');
  });
});

describe('counterHeaderMeta', () => {
  it('says nothing yet before anything is logged', () => {
    expect(counterHeaderMeta({ logged: 0, bestStreak: 0 })).toEqual({
      lead: 'Nothing yet',
      trail: null,
    });
  });

  it('counts logged counters and keeps the run apart', () => {
    expect(counterHeaderMeta({ logged: 2, bestStreak: 4 })).toEqual({
      lead: '2 counters logged',
      trail: '4 days in a row',
    });
  });
});
