import {
  clearOptionsAreEmpty,
  DEFAULT_CLEAR_OPTIONS,
  describeClearPlan,
  resolveActivityDeleteBeforeDate,
} from '../src/db/clearDataPlan';

describe('clearDataPlan', () => {
  const today = new Date(2026, 6, 20); // 20 Jul 2026 local

  it('resolves all-time as null cutoff', () => {
    expect(resolveActivityDeleteBeforeDate({ kind: 'all' }, today)).toBeNull();
  });

  it('keeps last 7 days by deleting before today-6', () => {
    expect(resolveActivityDeleteBeforeDate({ kind: 'keepLastDays', days: 7 }, today)).toBe(
      '2026-07-14',
    );
  });

  it('keeps last 30 days by deleting before today-29', () => {
    expect(resolveActivityDeleteBeforeDate({ kind: 'keepLastDays', days: 30 }, today)).toBe(
      '2026-06-21',
    );
  });

  it('uses custom before date', () => {
    expect(
      resolveActivityDeleteBeforeDate({ kind: 'beforeDate', date: '2026-01-01' }, today),
    ).toBe('2026-01-01');
  });

  it('rejects invalid before date', () => {
    expect(() =>
      resolveActivityDeleteBeforeDate({ kind: 'beforeDate', date: 'nope' }, today),
    ).toThrow(/YYYY-MM-DD/);
  });

  it('detects empty clear options', () => {
    expect(
      clearOptionsAreEmpty({
        ...DEFAULT_CLEAR_OPTIONS,
        activityHistory: false,
      }),
    ).toBe(true);
    expect(clearOptionsAreEmpty(DEFAULT_CLEAR_OPTIONS)).toBe(false);
  });

  it('describes activity keep-last plan', () => {
    const lines = describeClearPlan(
      {
        ...DEFAULT_CLEAR_OPTIONS,
        activityPeriod: { kind: 'keepLastDays', days: 7 },
      },
      today,
    );
    expect(lines.some((line) => line.includes('2026-07-14'))).toBe(true);
  });

  it('describes definitions as wiping activity too', () => {
    const lines = describeClearPlan({
      ...DEFAULT_CLEAR_OPTIONS,
      definitions: true,
      activityHistory: true,
    });
    expect(lines.join(' ')).toMatch(/Habits, counters/i);
    expect(lines.join(' ')).toMatch(/activity history/i);
  });

  it('describes incomplete before-date without throwing', () => {
    expect(() =>
      describeClearPlan({
        ...DEFAULT_CLEAR_OPTIONS,
        activityPeriod: { kind: 'beforeDate', date: '' },
      }),
    ).not.toThrow();
    const lines = describeClearPlan({
      ...DEFAULT_CLEAR_OPTIONS,
      activityPeriod: { kind: 'beforeDate', date: '' },
    });
    expect(lines.join(' ')).toMatch(/YYYY-MM-DD/);
  });
});
