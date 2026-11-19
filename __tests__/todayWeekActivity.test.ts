import { buildWeekActivity, weekSummary } from '../src/screens/today/weekActivity';

// 2026-11-18 is a Wednesday; its week runs Monday the 16th to Sunday the 22nd.
const WEDNESDAY = '2026-11-18';

function week(overrides: Partial<Parameters<typeof buildWeekActivity>[0]> = {}) {
  return buildWeekActivity({
    today: WEDNESDAY,
    trackerCount: 4,
    loggedByDate: new Map(),
    loggedToday: 0,
    ...overrides,
  });
}

describe('buildWeekActivity', () => {
  it('lays out Monday to Sunday of the week that holds today', () => {
    expect(week().map((day) => day.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it('marks what is behind, today, and still to come', () => {
    expect(week().map((day) => day.when)).toEqual([
      'past',
      'past',
      'today',
      'future',
      'future',
      'future',
      'future',
    ]);
  });

  it('fills a past day by the share of trackers logged on it', () => {
    const days = week({ loggedByDate: new Map([['2026-11-16', 1], ['2026-11-17', 4]]) });

    expect(days[0]!.share).toBe(0.25);
    expect(days[1]!.share).toBe(1);
  });

  it('reads today from the live count, not from the stored one', () => {
    const days = week({ loggedByDate: new Map([[WEDNESDAY, 4]]), loggedToday: 2 });

    expect(days[2]!.share).toBe(0.5);
  });

  it('keeps the days to come empty whatever the data says', () => {
    const days = week({ loggedByDate: new Map([['2026-11-20', 3]]) });

    expect(days[4]!.share).toBe(0);
  });

  it('never fills past full when a tracker archived since was logged that day', () => {
    const days = week({ trackerCount: 2, loggedByDate: new Map([['2026-11-16', 3]]) });

    expect(days[0]!.share).toBe(1);
  });

  it('is empty without trackers, so no strip is drawn', () => {
    expect(week({ trackerCount: 0 })).toEqual([]);
  });

  it('starts a Monday week on today and ends a Sunday week on it', () => {
    expect(week({ today: '2026-11-16' }).map((day) => day.when)[0]).toBe('today');
    const sunday = week({ today: '2026-11-22' });
    expect(sunday[0]!.date).toBe('2026-11-16');
    expect(sunday[6]!.when).toBe('today');
  });
});

describe('weekSummary', () => {
  it('counts the days so far and the days with anything logged', () => {
    const days = week({ loggedByDate: new Map([['2026-11-16', 1]]), loggedToday: 2 });

    expect(weekSummary(days)).toEqual({ elapsed: 3, active: 2 });
  });
});
