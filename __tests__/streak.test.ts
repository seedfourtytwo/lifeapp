import { computeStreak, computeFailureStreak } from '../src/utils/streak';

describe('computeStreak', () => {
  it('counts consecutive completed days ending today', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-02', '2025-01-03'],
      '2025-01-03',
    );
    expect(streak).toBe(3);
  });

  it('counts streak ending yesterday when today is not done', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-02'],
      '2025-01-03',
    );
    expect(streak).toBe(2);
  });

  it('stops at the first missed day', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-03'],
      '2025-01-03',
    );
    expect(streak).toBe(1);
  });

  it('skips unscheduled days without breaking the streak', () => {
    const streak = computeStreak(
      ['2025-01-01', '2025-01-03'],
      '2025-01-03',
      (date) => date !== '2025-01-02',
    );
    expect(streak).toBe(2);
  });
});

describe('computeFailureStreak', () => {
  it('returns 0 when today is complete', () => {
    const failureStreak = computeFailureStreak(
      ['2025-01-01', '2025-01-02', '2025-01-03'],
      '2025-01-03',
    );
    expect(failureStreak).toBe(0);
  });

  it('counts consecutive missed days ending yesterday', () => {
    const failureStreak = computeFailureStreak(
      ['2025-01-01'],
      '2025-01-04',
    );
    expect(failureStreak).toBe(2);
  });

  it('stops at the first completed day', () => {
    const failureStreak = computeFailureStreak(
      ['2025-01-01', '2025-01-03'],
      '2025-01-05',
    );
    expect(failureStreak).toBe(1);
  });

  it('ignores misses before createdOn', () => {
    const failureStreak = computeFailureStreak(
      [],
      '2025-01-10',
      () => true,
      365,
      '2025-01-08',
    );
    // Jan 8 and 9 missed; days before creation ignored.
    expect(failureStreak).toBe(2);
  });
});
