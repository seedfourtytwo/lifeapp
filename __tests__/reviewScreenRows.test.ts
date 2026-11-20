/**
 * Review's two lists: which trackers are holding and which are slipping, and
 * what each row shows and says.
 */
import type { ReviewTracker, TrackerStanding } from '../src/review';
import { standingRows } from '../src/screens/review/reviewRows';

const habit = (id: string, trackingMode: 'boolean' | 'timer', timesPerWeek?: number): ReviewTracker => ({
  id,
  rules: {
    kind: 'habit',
    config: {
      trackingMode,
      timeSlot: 'anytime',
      schedule: timesPerWeek ? { type: 'times_per_week', times: timesPerWeek } : { type: 'daily' },
    },
  },
  createdOn: null,
});
const counter: ReviewTracker = {
  id: 'water',
  rules: { kind: 'counter', config: { unit: 'glass', quickIncrements: [1], dailyTarget: 8 } },
  createdOn: null,
};
const TRACKERS = new Map(
  [
    { tracker: habit('smoke', 'boolean'), name: 'No Smoking' },
    { tracker: habit('sit', 'timer'), name: 'Meditation' },
    { tracker: habit('run', 'boolean', 3), name: 'Run' },
    { tracker: counter, name: 'Water' },
  ].map((entry) => [entry.tracker.id, entry]),
);
const standing = (trackerId: string, done: number, planned: number, skipped = 0): TrackerStanding => ({
  trackerId,
  done,
  planned,
  skipped,
  share: done / planned,
});
const rows = (standings: TrackerStanding[]) => standingRows(standings, (id) => TRACKERS.get(id));

describe('standingRows', () => {
  it('holds from half done up, and slips below, keeping the ranking', () => {
    const { holding, slipping } = rows([
      standing('smoke', 19, 20),
      standing('sit', 10, 20),
      standing('water', 9, 20),
      standing('run', 2, 9),
    ]);
    expect(holding.map((row) => row.id)).toEqual(['smoke', 'sit']);
    expect(slipping.map((row) => row.id)).toEqual(['water', 'run']);
  });

  it('has no rows without standings', () => {
    expect(rows([])).toEqual({ holding: [], slipping: [] });
  });

  it('colours a row by its kind, a habit by how it is tracked', () => {
    const { holding } = rows([standing('smoke', 1, 1), standing('sit', 1, 1), standing('water', 1, 1)]);
    expect(holding.map((row) => row.kind)).toEqual(['tick', 'timer', 'counter']);
  });

  it('pads every tally to the widest, across both lists, so the figures line up', () => {
    const { holding, slipping } = rows([standing('smoke', 19, 20), standing('run', 2, 9)]);
    expect(holding[0].figure).toBe('19 / 20');
    expect(slipping[0].figure).toBe(' 2 /  9');
  });

  it('carries the name, the share, and a spoken tally in days or sessions', () => {
    const { holding, slipping } = rows([standing('smoke', 19, 20, 1), standing('run', 2, 9)]);
    expect(holding[0]).toMatchObject({
      name: 'No Smoking',
      share: 19 / 20,
      spoken: { key: 'spoken.days', params: { name: 'No Smoking', done: 19, count: 20, missed: 1, skipped: 1 } },
    });
    expect(slipping[0].spoken).toEqual({
      key: 'spoken.sessions',
      params: { name: 'Run', done: 2, count: 9, missed: 7, skipped: 0 },
    });
  });

  it('drops a standing whose tracker is gone', () => {
    expect(rows([standing('archived', 1, 2)])).toEqual({ holding: [], slipping: [] });
  });
});
