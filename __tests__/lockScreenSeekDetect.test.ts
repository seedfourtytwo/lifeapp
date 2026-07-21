import { detectLockScreenSeekSkip, isLockScreenLoopWrap } from '../src/audio/lockScreenSeekDetect';

describe('detectLockScreenSeekSkip', () => {
  it('ignores normal ~1s progress on keepalive', () => {
    expect(
      detectLockScreenSeekSkip({
        currentTime: 1.0,
        lastCurrentTime: 0.0,
        duration: 2,
        loop: true,
        wallDeltaMs: 1000,
      }),
    ).toBeNull();
  });

  it('detects instant +10s seek on long tracks', () => {
    expect(
      detectLockScreenSeekSkip({
        currentTime: 25,
        lastCurrentTime: 15,
        duration: 900,
        loop: false,
        wallDeltaMs: 50,
      }),
    ).toBe('next');
  });

  it('ignores background catch-up of ~10s', () => {
    expect(
      detectLockScreenSeekSkip({
        currentTime: 25,
        lastCurrentTime: 15,
        duration: 900,
        loop: false,
        wallDeltaMs: 12_000,
      }),
    ).toBeNull();
  });

  it('detects clamped seek on short keepalive', () => {
    expect(
      detectLockScreenSeekSkip({
        currentTime: 2.0,
        lastCurrentTime: 0.3,
        duration: 2,
        loop: true,
        wallDeltaMs: 40,
      }),
    ).toBe('next');
  });

  it('ignores loop wrap', () => {
    expect(
      isLockScreenLoopWrap({
        currentTime: 0.05,
        lastCurrentTime: 1.95,
        duration: 2,
        loop: true,
      }),
    ).toBe(true);
    expect(
      detectLockScreenSeekSkip({
        currentTime: 0.05,
        lastCurrentTime: 1.95,
        duration: 2,
        loop: true,
        wallDeltaMs: 40,
      }),
    ).toBeNull();
  });
});
