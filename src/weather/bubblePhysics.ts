/** Fling / bounce physics for the home weather chip (pixel space). */

export const BUBBLE_FRICTION = 4.0;
export const BUBBLE_RESTITUTION = 0.38;
export const BUBBLE_MIN_SPEED = 35;
/** High enough that soft vs hard flicks still feel different. */
export const BUBBLE_MAX_SPEED = 4500;
/** Ignore tiny flicks — treat as a place, not a throw. */
export const BUBBLE_FLING_THRESHOLD = 80;
/** Look at this recent window when estimating release velocity. */
export const BUBBLE_VELOCITY_WINDOW_MS = 90;

export interface BubblePhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BubblePhysicsBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface BubbleMotionSample {
  t: number;
  x: number;
  y: number;
}

const MAX_MOTION_SAMPLES = 24;
const MOTION_SAMPLE_MAX_AGE_MS = 180;

/** Push a finger sample and trim old / excess entries in place. */
export function appendMotionSample(
  samples: BubbleMotionSample[],
  sample: BubbleMotionSample,
): void {
  samples.push(sample);
  while (samples.length > MAX_MOTION_SAMPLES) samples.shift();
  while (samples.length > 1 && sample.t - samples[0]!.t > MOTION_SAMPLE_MAX_AGE_MS) {
    samples.shift();
  }
}

export function clampSpeed(vx: number, vy: number, max = BUBBLE_MAX_SPEED): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed <= max || speed === 0) return { vx, vy };
  const scale = max / speed;
  return { vx: vx * scale, vy: vy * scale };
}

/**
 * Velocity from recent finger samples (px/s). Uses the oldest→newest point
 * inside the window so soft and hard flicks stay distinct.
 */
export function velocityFromSamples(
  samples: BubbleMotionSample[],
  now = Date.now(),
  windowMs = BUBBLE_VELOCITY_WINDOW_MS,
): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };

  const cutoff = now - windowMs;
  let startIdx = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i]!.t < cutoff) {
      startIdx = Math.min(i + 1, samples.length - 2);
      break;
    }
    startIdx = i;
  }

  const a = samples[startIdx]!;
  const b = samples[samples.length - 1]!;
  const dt = (b.t - a.t) / 1000;
  if (dt < 0.012) {
    const prev = samples[samples.length - 2]!;
    const dt2 = (b.t - prev.t) / 1000;
    if (dt2 <= 0) return { vx: 0, vy: 0 };
    return { vx: (b.x - prev.x) / dt2, vy: (b.y - prev.y) / dt2 };
  }
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}

/**
 * Advance one physics step. Bounces off bounds with restitution and applies
 * exponential friction. `settled` when speed drops below the floor.
 * `cornerHit` only when already near a corner and both walls bounce (DVD logo).
 */
export function stepBubblePhysics(
  state: BubblePhysicsState,
  bounds: BubblePhysicsBounds,
  dtSec: number,
  opts?: {
    friction?: number;
    restitution?: number;
    minSpeed?: number;
    /** Min pre-bounce speed required to count as a corner celebration. */
    cornerMinSpeed?: number;
    /** Must already be this close to both edges before the bounce frame. */
    cornerProximityPx?: number;
  },
): { state: BubblePhysicsState; settled: boolean; cornerHit: boolean } {
  const friction = opts?.friction ?? BUBBLE_FRICTION;
  const restitution = opts?.restitution ?? BUBBLE_RESTITUTION;
  const minSpeed = opts?.minSpeed ?? BUBBLE_MIN_SPEED;
  const cornerMinSpeed = opts?.cornerMinSpeed ?? 420;
  const cornerProximityPx = opts?.cornerProximityPx ?? 14;
  const dt = Math.max(0, Math.min(0.05, dtSec));

  let { x, y, vx, vy } = state;
  const speedBefore = Math.hypot(vx, vy);

  const nearLeft = x <= bounds.minX + cornerProximityPx;
  const nearRight = x >= bounds.maxX - cornerProximityPx;
  const nearTop = y <= bounds.minY + cornerProximityPx;
  const nearBottom = y >= bounds.maxY - cornerProximityPx;
  const aimedAtCorner =
    ((nearLeft && vx < 0) || (nearRight && vx > 0)) &&
    ((nearTop && vy < 0) || (nearBottom && vy > 0));

  x += vx * dt;
  y += vy * dt;

  let hitX = false;
  let hitY = false;

  if (x < bounds.minX) {
    x = bounds.minX;
    vx = Math.abs(vx) * restitution;
    hitX = true;
  } else if (x > bounds.maxX) {
    x = bounds.maxX;
    vx = -Math.abs(vx) * restitution;
    hitX = true;
  }

  if (y < bounds.minY) {
    y = bounds.minY;
    vy = Math.abs(vy) * restitution;
    hitY = true;
  } else if (y > bounds.maxY) {
    y = bounds.maxY;
    vy = -Math.abs(vy) * restitution;
    hitY = true;
  }

  const cornerHit =
    hitX && hitY && aimedAtCorner && speedBefore >= cornerMinSpeed;

  const damp = Math.exp(-friction * dt);
  vx *= damp;
  vy *= damp;

  const settled = Math.hypot(vx, vy) < minSpeed;
  if (settled) {
    return { state: { x, y, vx: 0, vy: 0 }, settled: true, cornerHit };
  }
  return { state: { x, y, vx, vy }, settled: false, cornerHit };
}
