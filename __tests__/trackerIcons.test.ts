import {
  TRACKER_ICON_IDS,
  TRACKER_ICON_FEATURED_IDS,
  iconIdMatchesQuery,
  isCustomTrackerIconId,
  isFeaturedTrackerIconId,
  isTrackerIconId,
} from '../src/protocol/trackerIcons';

describe('trackerIcons', () => {
  it('exposes a curated allowlist with a short featured set', () => {
    expect(TRACKER_ICON_FEATURED_IDS.length).toBeLessThanOrEqual(14);
    expect(TRACKER_ICON_IDS.length).toBeGreaterThan(TRACKER_ICON_FEATURED_IDS.length);
    expect(new Set(TRACKER_ICON_IDS).size).toBe(TRACKER_ICON_IDS.length);
    expect(isTrackerIconId('meditation')).toBe(true);
    expect(isTrackerIconId('push-up')).toBe(true);
    expect(isTrackerIconId('pull-up')).toBe(true);
    expect(isTrackerIconId('soccer')).toBe(true);
    expect(isTrackerIconId('laptop')).toBe(true);
    expect(isTrackerIconId('not-real')).toBe(false);
  });

  it('distinguishes featured vs custom ids', () => {
    expect(isFeaturedTrackerIconId('meditation')).toBe(true);
    expect(isFeaturedTrackerIconId('coffee')).toBe(false);
    expect(isCustomTrackerIconId('push-up')).toBe(true);
    expect(isCustomTrackerIconId('dumbbell')).toBe(false);
  });

  it('matches icon search against slugs and spaced words', () => {
    expect(iconIdMatchesQuery('push-up', '')).toBe(true);
    expect(iconIdMatchesQuery('push-up', 'push')).toBe(true);
    expect(iconIdMatchesQuery('push-up', 'push up')).toBe(true);
    expect(iconIdMatchesQuery('lightbulb-outline', 'light')).toBe(true);
    expect(iconIdMatchesQuery('coffee', 'zzz')).toBe(false);
  });
});
