import { i18n } from '../src/i18n';
import { todayHeaderMeta } from '../src/screens/shared/dayHeaderMeta';

describe('todayHeaderMeta', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('says nothing is due when the day holds nothing to finish', () => {
    expect(todayHeaderMeta({ due: 0, done: 0, bestStreak: 9 })).toEqual({
      lead: 'Nothing due',
      trail: null,
    });
  });

  it('puts the count on the left and the best run on the right', () => {
    expect(todayHeaderMeta({ due: 9, done: 3, bestStreak: 41 })).toEqual({
      lead: '3 of 9 done',
      trail: '41 days in a row',
    });
  });

  it('drops the run when there is none', () => {
    expect(todayHeaderMeta({ due: 3, done: 3, bestStreak: 0 }).trail).toBeNull();
  });

  it('counts habits, counters and todos together, so French does not agree with "habitudes"', async () => {
    await i18n.changeLanguage('fr');

    expect(todayHeaderMeta({ due: 9, done: 3, bestStreak: 0 }).lead).toBe('3 sur 9 faits');
  });
});
