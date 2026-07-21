/**
 * Detect lock-screen seek ±10s gestures from playback status, without
 * treating normal progress, loop wraps, or background catch-up as skips.
 */
export function detectLockScreenSeekSkip(input: {
  currentTime: number;
  lastCurrentTime: number;
  duration: number;
  loop: boolean;
  wallDeltaMs: number;
}): 'next' | 'prev' | null {
  const { currentTime, lastCurrentTime, duration, loop, wallDeltaMs } = input;
  const mediaDelta = currentTime - lastCurrentTime;

  // Loop wrap on short keepalive — not a skip.
  if (
    loop &&
    mediaDelta < -0.5 &&
    duration > 0 &&
    lastCurrentTime >= Math.max(0, duration - 0.75)
  ) {
    return null;
  }

  // Only count nearly-instant jumps (button tap), not coalesced background catch-up.
  if (wallDeltaMs >= 800) {
    return null;
  }

  // expo-audio seek buttons jump ±10s on long tracks.
  if (Math.abs(mediaDelta) >= 8 && Math.abs(mediaDelta) <= 12) {
    return mediaDelta > 0 ? 'next' : 'prev';
  }

  // On the short keepalive clip, +10s clamps to the end — still an instant jump.
  if (
    duration > 0 &&
    duration < 5 &&
    Math.abs(mediaDelta) >= 0.5 &&
    !(loop && mediaDelta < 0)
  ) {
    return mediaDelta > 0 ? 'next' : 'prev';
  }

  return null;
}

export function isLockScreenLoopWrap(input: {
  currentTime: number;
  lastCurrentTime: number;
  duration: number;
  loop: boolean;
}): boolean {
  const { currentTime, lastCurrentTime, duration, loop } = input;
  const mediaDelta = currentTime - lastCurrentTime;
  return (
    loop &&
    mediaDelta < -0.5 &&
    duration > 0 &&
    lastCurrentTime >= Math.max(0, duration - 0.75)
  );
}
