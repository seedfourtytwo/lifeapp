import {
  TRACKER_ICON_IDS,
  isTrackerIconId,
} from '../src/protocol/trackerIcons';

describe('trackerIcons', () => {
  it('exposes a curated allowlist', () => {
    expect(TRACKER_ICON_IDS.length).toBeGreaterThan(20);
    expect(isTrackerIconId('meditation')).toBe(true);
    expect(isTrackerIconId('not-real')).toBe(false);
  });
});
