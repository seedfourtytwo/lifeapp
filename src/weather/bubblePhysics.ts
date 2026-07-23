/**
 * Fling / bounce physics for the home weather chip (pixel space).
 *
 * Gesture model:
 * - Finger down → charge fills continuously (moving does not pause it)
 * - Slow release before LAUNCH_MIN → precise place
 * - Past LAUNCH_MIN → shot committed; release throws along aim
 * - Fast flick → throw; charge scales coast energy smoothly
 */

/** Exponential slowdown — higher = stickier ball. */
export const BUBBLE_FRICTION = 4.9;
/** Energy kept on a normal wall bounce. */
export const BUBBLE_RESTITUTION = 0.7;
/**
 * Corner hits (both axes in one frame) push back harder — satisfying DVD kick.
 * Effective corner restitution = min(0.95, wall * scale).
 */
export const BUBBLE_CORNER_RESTITUTION_SCALE = 1.5;
export const BUBBLE_MIN_SPEED = 32;
/** Peak finger speed below this is a place (unless charge is committed). */
export const BUBBLE_PLACE_SPEED = 150;
/** Ignore tiny flicks when composing a moving throw. */
export const BUBBLE_FLING_THRESHOLD = 70;
/** Look for peak finger speed inside this release window. */
export const BUBBLE_VELOCITY_WINDOW_MS = 120;
/** Hold duration to fill the charge border (ms). */
export const BUBBLE_CHARGE_MS = 3200;
/** Delay after press/hold before the charge ring starts (keeps slow place clean). */
export const BUBBLE_CHARGE_ARM_MS = 480;
/** Min charge before release is treated as a committed throw. */
export const BUBBLE_CHARGE_LAUNCH_MIN = 0.18;
/** Below this on a still press → tap (open forecast), not place/fling. */
export const BUBBLE_CHARGE_TAP_MAX = 0.12;
/** How close to a corner pocket the chip must be before the step. */
export const BUBBLE_CORNER_PROXIMITY_PX = 6;
/** Minimum approach speed for a scored DVD corner. */
export const BUBBLE_CORNER_MIN_SPEED = 900;
/** Each axis must be pushing into the corner at least this hard. */
export const BUBBLE_CORNER_MIN_AXIS_SPEED = 420;
/**
 * Incoming motion must be close to a true diagonal:
 * min(|vx|,|vy|) / speed >= this (rejects wall-scrapes and shallow clips).
 */
export const BUBBLE_CORNER_MIN_AXIS_RATIO = 0.46;

/**
 * Coast budgets (px). Empty flick stays local; mid-fill (secret) already
 * reaches the 3-corner band; full adds leftover forgiveness.
 */
export const BUBBLE_TRAVEL_FLICK_PX = 210;
export const BUBBLE_TRAVEL_FULL_PX = 1780;

/** Finger flick only nudges ± within the charge budget. */
export const BUBBLE_FLICK_BLEND = 0.14;
/** Peak finger speed (px/s) that maps to a full +flick blend. */
export const BUBBLE_FLICK_REF_SPEED = 1600;

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

export type BubbleReleaseKind = 'tap' | 'place' | 'fling';

export interface BubbleReleaseResult {
  kind: BubbleReleaseKind;
  vx: number;
  vy: number;
}

const MAX_MOTION_SAMPLES = 32;
const MOTION_SAMPLE_MAX_AGE_MS = 220;
const MIN_SAMPLE_DT_SEC = 0.004;

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

export function clampSpeed(vx: number, vy: number, max: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed <= max || speed === 0) return { vx, vy };
  const scale = max / speed;
  return { vx: vx * scale, vy: vy * scale };
}

/** Release speed that coasts ~`travelPx` under current friction (no walls). */
export function speedForTravel(travelPx: number, friction = BUBBLE_FRICTION): number {
  return Math.max(0, travelPx) * friction;
}

/**
 * Smooth charge → coast budget. Ease-out so mid-fill already sits in the
 * multi-corner band without announcing a half tier in the UI.
 */
export function travelBudgetForCharge(charge: number): number {
  const c = Math.max(0, Math.min(1, charge));
  const eased = 1 - (1 - c) * (1 - c);
  return BUBBLE_TRAVEL_FLICK_PX + (BUBBLE_TRAVEL_FULL_PX - BUBBLE_TRAVEL_FLICK_PX) * eased;
}

export function releaseSpeedForCharge(charge: number): number {
  return speedForTravel(travelBudgetForCharge(charge));
}

function unitOrNull(x: number, y: number): { x: number; y: number } | null {
  const len = Math.hypot(x, y);
  if (len < 1e-3) return null;
  return { x: x / len, y: y / len };
}

/**
 * Compose throw velocity from aim + charge.
 * Charge owns energy; flick strength only blends ± within that budget.
 */
export function composeBubbleThrow(
  fingerVx: number,
  fingerVy: number,
  charge: number,
  aim?: { x: number; y: number },
): { vx: number; vy: number } {
  const c = Math.max(0, Math.min(1, charge));
  const fingerSpeed = Math.hypot(fingerVx, fingerVy);
  const dir =
    unitOrNull(fingerVx, fingerVy) ??
    (aim ? unitOrNull(aim.x, aim.y) : null);

  if (!dir) return { vx: 0, vy: 0 };

  if (fingerSpeed < BUBBLE_FLING_THRESHOLD && c < BUBBLE_CHARGE_LAUNCH_MIN) {
    return { vx: 0, vy: 0 };
  }

  const base = releaseSpeedForCharge(c);
  const flickT = Math.max(0, Math.min(1, fingerSpeed / BUBBLE_FLICK_REF_SPEED));
  const blend = 1 + (flickT - 0.5) * 2 * BUBBLE_FLICK_BLEND;
  const speed = base * blend;
  const maxSpeed = releaseSpeedForCharge(1) * (1 + BUBBLE_FLICK_BLEND);
  return clampSpeed(dir.x * speed, dir.y * speed, maxSpeed);
}

/**
 * Decide tap / precise place / fling from release samples.
 *
 * Once charge crosses LAUNCH_MIN the shot is committed (fill continues while
 * aiming). Below that, slow fingers place so quick repositioning stays precise.
 */
export function resolveBubbleRelease(input: {
  moved: boolean;
  fingerVx: number;
  fingerVy: number;
  charge: number;
  aim?: { x: number; y: number };
}): BubbleReleaseResult {
  const { moved, fingerVx, fingerVy, charge, aim } = input;
  const speed = Math.hypot(fingerVx, fingerVy);
  // Pure still charge with no drag aim — nudge diagonally so release still fires.
  const resolvedAim = aim ?? { x: 1, y: 1 };

  if (!moved && charge < BUBBLE_CHARGE_TAP_MAX) {
    return { kind: 'tap', vx: 0, vy: 0 };
  }

  // Committed charge shot: finger speed only blends power; aim steers.
  if (charge >= BUBBLE_CHARGE_LAUNCH_MIN) {
    const thrown = composeBubbleThrow(fingerVx, fingerVy, charge, resolvedAim);
    if (Math.hypot(thrown.vx, thrown.vy) >= BUBBLE_FLING_THRESHOLD) {
      return { kind: 'fling', vx: thrown.vx, vy: thrown.vy };
    }
    return { kind: 'place', vx: 0, vy: 0 };
  }

  // Uncommitted: slow = place, fast = flick.
  if (speed < BUBBLE_PLACE_SPEED) {
    return { kind: 'place', vx: 0, vy: 0 };
  }

  const thrown = composeBubbleThrow(fingerVx, fingerVy, charge, resolvedAim);
  if (Math.hypot(thrown.vx, thrown.vy) >= BUBBLE_FLING_THRESHOLD) {
    return { kind: 'fling', vx: thrown.vx, vy: thrown.vy };
  }
  return { kind: 'place', vx: 0, vy: 0 };
}

/**
 * Velocity from recent finger samples (px/s).
 * Uses peak consecutive-pair speed so an accelerating flick isn't flattened.
 */
export function velocityFromSamples(
  samples: BubbleMotionSample[],
  now = Date.now(),
  windowMs = BUBBLE_VELOCITY_WINDOW_MS,
): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };

  const cutoff = now - windowMs;
  let bestVx = 0;
  let bestVy = 0;
  let bestSpeed = 0;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (b.t < cutoff) continue;
    const dt = (b.t - a.t) / 1000;
    if (dt < MIN_SAMPLE_DT_SEC) continue;
    const vx = (b.x - a.x) / dt;
    const vy = (b.y - a.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed > bestSpeed) {
      bestSpeed = speed;
      bestVx = vx;
      bestVy = vy;
    }
  }

  return { vx: bestVx, vy: bestVy };
}

function bounceAxis(
  velocity: number,
  restitution: number,
  inwardPositive: boolean,
): number {
  const mag = Math.abs(velocity) * restitution;
  return inwardPositive ? mag : -mag;
}

export interface BubbleHitEdges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export type BubbleCornerId = 'tl' | 'tr' | 'bl' | 'br';

/** Which screen corner a dual-edge hit corresponds to (if any). */
export function cornerIdFromEdges(edges: BubbleHitEdges): BubbleCornerId | null {
  if (edges.left && edges.top) return 'tl';
  if (edges.right && edges.top) return 'tr';
  if (edges.left && edges.bottom) return 'bl';
  if (edges.right && edges.bottom) return 'br';
  return null;
}

/**
 * True DVD corner: both walls in one frame, already in the pocket,
 * approaching on a real diagonal (not a wall-scrape that clips the other axis).
 */
export function isScoredCornerHit(input: {
  hitX: boolean;
  hitY: boolean;
  aimedAtCorner: boolean;
  vxBefore: number;
  vyBefore: number;
  minSpeed?: number;
  minAxisSpeed?: number;
  minAxisRatio?: number;
}): boolean {
  const {
    hitX,
    hitY,
    aimedAtCorner,
    vxBefore,
    vyBefore,
    minSpeed = BUBBLE_CORNER_MIN_SPEED,
    minAxisSpeed = BUBBLE_CORNER_MIN_AXIS_SPEED,
    minAxisRatio = BUBBLE_CORNER_MIN_AXIS_RATIO,
  } = input;
  if (!hitX || !hitY || !aimedAtCorner) return false;
  const ax = Math.abs(vxBefore);
  const ay = Math.abs(vyBefore);
  const speed = Math.hypot(ax, ay);
  if (speed < minSpeed) return false;
  if (ax < minAxisSpeed || ay < minAxisSpeed) return false;
  return Math.min(ax, ay) / speed >= minAxisRatio;
}

/**
 * Advance one physics step. True corner hits get a stronger kick.
 * `cornerHit` is the scored DVD corner (same rule as confetti / counter / L flash).
 */
export function stepBubblePhysics(
  state: BubblePhysicsState,
  bounds: BubblePhysicsBounds,
  dtSec: number,
  opts?: {
    friction?: number;
    restitution?: number;
    cornerRestitutionScale?: number;
    minSpeed?: number;
    cornerMinSpeed?: number;
    cornerProximityPx?: number;
    cornerMinAxisRatio?: number;
    cornerMinAxisSpeed?: number;
  },
): {
  state: BubblePhysicsState;
  settled: boolean;
  cornerHit: boolean;
  wallHit: boolean;
  hitEdges: BubbleHitEdges;
} {
  const friction = opts?.friction ?? BUBBLE_FRICTION;
  const restitution = opts?.restitution ?? BUBBLE_RESTITUTION;
  const cornerScale = opts?.cornerRestitutionScale ?? BUBBLE_CORNER_RESTITUTION_SCALE;
  const minSpeed = opts?.minSpeed ?? BUBBLE_MIN_SPEED;
  const cornerMinSpeed = opts?.cornerMinSpeed ?? BUBBLE_CORNER_MIN_SPEED;
  const cornerProximityPx = opts?.cornerProximityPx ?? BUBBLE_CORNER_PROXIMITY_PX;
  const cornerMinAxisRatio = opts?.cornerMinAxisRatio ?? BUBBLE_CORNER_MIN_AXIS_RATIO;
  const cornerMinAxisSpeed = opts?.cornerMinAxisSpeed ?? BUBBLE_CORNER_MIN_AXIS_SPEED;
  const dt = Math.max(0, Math.min(0.05, dtSec));

  let { x, y, vx, vy } = state;
  const vxBefore = vx;
  const vyBefore = vy;

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
    hitX = true;
  } else if (x > bounds.maxX) {
    x = bounds.maxX;
    hitX = true;
  }

  if (y < bounds.minY) {
    y = bounds.minY;
    hitY = true;
  } else if (y > bounds.maxY) {
    y = bounds.maxY;
    hitY = true;
  }

  const wallHit = hitX || hitY;
  const cornerHit = isScoredCornerHit({
    hitX,
    hitY,
    aimedAtCorner,
    vxBefore,
    vyBefore,
    minSpeed: cornerMinSpeed,
    minAxisSpeed: cornerMinAxisSpeed,
    minAxisRatio: cornerMinAxisRatio,
  });

  // Stronger kick only for scored corners — glancing dual-clips keep wall restitution.
  const r = cornerHit
    ? Math.min(0.95, restitution * cornerScale)
    : restitution;

  if (hitX) vx = bounceAxis(vx, r, x <= bounds.minX);
  if (hitY) vy = bounceAxis(vy, r, y <= bounds.minY);

  const hitEdges: BubbleHitEdges = {
    left: hitX && x <= bounds.minX,
    right: hitX && x >= bounds.maxX,
    top: hitY && y <= bounds.minY,
    bottom: hitY && y >= bounds.maxY,
  };

  const damp = Math.exp(-friction * dt);
  vx *= damp;
  vy *= damp;

  const settled = Math.hypot(vx, vy) < minSpeed;
  if (settled) {
    return {
      state: { x, y, vx: 0, vy: 0 },
      settled: true,
      cornerHit,
      wallHit,
      hitEdges,
    };
  }
  return { state: { x, y, vx, vy }, settled: false, cornerHit, wallHit, hitEdges };
}
