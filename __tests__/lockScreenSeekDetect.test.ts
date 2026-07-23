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

  it('ignores the first post-play tick on keepalive (false skip that stopped timers)', () => {
    // After withLocalControl's 250ms unlock, first status often has wallDelta ~750ms
    // and mediaDelta ~0.7 on a 2s clip — must NOT count as seek-forward.
    expect(
      detectLockScreenSeekSkip({
        currentTime: 1.0,
        lastCurrentTime: 0.25,
        duration: 2,
        loop: true,
        wallDeltaMs: 750,
      }),
    ).toBeNull();
    expect(
      detectLockScreenSeekSkip({
        currentTime: 0.8,
        lastCurrentTime: 0.2,
        duration: 2,
        loop: false,
        wallDeltaMs: 200,
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

  it('detects clamped seek-forward on short keepalive', () => {
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

  it('detects clamped seek-backward on short keepalive', () => {
    expect(
      detectLockScreenSeekSkip({
        currentTime: 0.0,
        lastCurrentTime: 1.2,
        duration: 2,
        loop: true,
        wallDeltaMs: 40,
      }),
    ).toBe('prev');
  });

  it('ignores reaching the end of keepalive over normal wall time', () => {
    expect(
      detectLockScreenSeekSkip({
        currentTime: 2.0,
        lastCurrentTime: 1.0,
        duration: 2,
        loop: true,
        wallDeltaMs: 1000,
      }),
    ).toBeNull();
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
