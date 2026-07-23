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

  // Only count nearly-instant jumps (button tap), not coalesced background catch-up
  // or the first status tick after local play/seek (often ~500–750ms wall time).
  if (wallDeltaMs >= 300) {
    return null;
  }

  // expo-audio seek buttons jump ±10s on long tracks.
  if (Math.abs(mediaDelta) >= 8 && Math.abs(mediaDelta) <= 12) {
    return mediaDelta > 0 ? 'next' : 'prev';
  }

  // Short keepalive (~2s): +10s / −10s clamp to end / start. Require a near-instant
  // jump to the boundary — never treat normal 0.5s+ progress as a skip (that was
  // finishing no-sound timers after ~1–2s).
  if (duration > 0 && duration < 5) {
    if (mediaDelta > 0 && currentTime >= duration - 0.2 && mediaDelta >= 0.4) {
      return 'next';
    }
    if (mediaDelta < 0 && currentTime <= 0.2 && mediaDelta <= -0.4) {
      return 'prev';
    }
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
