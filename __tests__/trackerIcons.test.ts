import {
  TRACKER_ICON_IDS,
  TRACKER_ICON_FEATURED_IDS,
  isCustomTrackerIconId,
  isFeaturedTrackerIconId,
  isTrackerIconId,
} from '../src/protocol/trackerIcons';

describe('trackerIcons', () => {
  it('exposes a curated allowlist with a short featured set', () => {
    expect(TRACKER_ICON_FEATURED_IDS.length).toBeLessThanOrEqual(14);
    expect(TRACKER_ICON_IDS.length).toBeGreaterThan(TRACKER_ICON_FEATURED_IDS.length);
    expect(isTrackerIconId('meditation')).toBe(true);
    expect(isTrackerIconId('push-up')).toBe(true);
    expect(isTrackerIconId('pull-up')).toBe(true);
    expect(isTrackerIconId('not-real')).toBe(false);
  });

  it('distinguishes featured vs custom ids', () => {
    expect(isFeaturedTrackerIconId('meditation')).toBe(true);
    expect(isFeaturedTrackerIconId('coffee')).toBe(false);
    expect(isCustomTrackerIconId('push-up')).toBe(true);
    expect(isCustomTrackerIconId('dumbbell')).toBe(false);
  });
});
