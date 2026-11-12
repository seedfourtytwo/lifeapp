/**
 * The Night road as flat shapes, in a 300 × 96 box: a road running to the
 * horizon, a dash for each day behind (bright when kept, dim when not, none
 * before the tracker existed), a lamp at the roadside for the next
 * milestone, and two small tail lights for you. The same geometry the
 * widget draws natively (`RoadScene.kt` in `modules/life-core`), so the app
 * and the lock screen show one picture. No glow and no halo: plain shapes.
 */

export const ROAD_BOX = { width: 300, height: 96 } as const;

const HORIZON_Y = 22;
const VANISH_X = 0.56;
const HALF_ROAD = 0.46;
/** How fast the road shrinks with distance. */
const DEPTH = 1.9;

/** During a ride the car drives from here… */
export const RIDE_CAR_START = 0.3;
/** …to the lamp, standing here. */
export const RIDE_LAMP_AT = 0.92;

/** Under reduced motion the car moves in steps of this much road. */
const REDUCED_MOTION_STEP = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A point `distance` along the road (0 its near edge, 1 the horizon): its centre, its scale, the road's half width there. */
export interface RoadPoint {
  x: number;
  y: number;
  size: number;
  half: number;
}

export function roadPoint(distance: number): RoadPoint {
  const near = (1 - clamp01(distance)) ** DEPTH;
  const vanishX = ROAD_BOX.width * VANISH_X;
  return {
    x: vanishX + (ROAD_BOX.width / 2 - vanishX) * near,
    y: HORIZON_Y + (ROAD_BOX.height - HORIZON_Y) * near,
    size: 0.06 + 0.94 * near,
    half: ROAD_BOX.width * HALF_ROAD * near,
  };
}

export interface RoadLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface RoadCircle {
  cx: number;
  cy: number;
  r: number;
}

export interface RoadSceneInput {
  /** Where the car is: 0 the road's near edge, 1 the horizon. */
  carAt: number;
  /** Where the next lamp stands, or null for none. */
  lampAt?: number | null;
  /** The days behind, oldest first: brightness 0–1, or null for a day that does not count. */
  dashes?: readonly (number | null)[];
}

export interface RoadSceneShapes {
  /** The road surface, as polygon points. */
  road: string;
  dashes: (RoadLine & { level: number })[];
  lamp: { post: RoadLine; light: RoadCircle } | null;
  tailLights: [RoadCircle, RoadCircle];
}

export function roadScene({ carAt, lampAt = null, dashes = [] }: RoadSceneInput): RoadSceneShapes {
  const horizon = roadPoint(1);
  const edge = roadPoint(0);
  const road = [
    [horizon.x - 2, horizon.y],
    [horizon.x + 2, horizon.y],
    [edge.x + edge.half, edge.y],
    [edge.x - edge.half, edge.y],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

  // The days behind: oldest nearest, the last one just behind the car.
  const stretch = carAt - 0.04;
  const shownDashes = dashes.flatMap((level, index) => {
    if (level === null) return [];
    const from = roadPoint((stretch * (index + 0.2)) / dashes.length);
    const to = roadPoint((stretch * (index + 0.75)) / dashes.length);
    return [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y, width: 1 + 6 * from.size, level }];
  });

  let lamp: RoadSceneShapes['lamp'] = null;
  if (lampAt !== null) {
    const base = roadPoint(lampAt);
    const x = base.x + base.half * 1.3;
    const height = 8 + 52 * base.size;
    lamp = {
      post: { x1: x, y1: base.y, x2: x, y2: base.y - height, width: 1 + 2.5 * base.size },
      light: { cx: x, cy: base.y - height, r: 1.5 + 4 * base.size },
    };
  }

  const car = roadPoint(carAt);
  const apart = 6 + 16 * car.size;
  const r = 1.2 + 2.2 * car.size;
  return {
    road,
    dashes: shownDashes,
    lamp,
    tailLights: [
      { cx: car.x - apart / 2, cy: car.y - r, r },
      { cx: car.x + apart / 2, cy: car.y - r, r },
    ],
  };
}

/** How far through its ride an urge is, 0 to 1, from the clock alone. */
export function rideProgress(startedAtMs: number, endsAtMs: number, nowMs: number): number {
  if (endsAtMs <= startedAtMs) return 1;
  return clamp01((nowMs - startedAtMs) / (endsAtMs - startedAtMs));
}

/** Where the car is at that point of the ride: from its start to the lamp. */
export function rideCarAt(progress: number): number {
  const p = clamp01(progress);
  return RIDE_CAR_START * (1 - p) + RIDE_LAMP_AT * p;
}

/**
 * Where the car is drawn. Under reduced motion it moves in whole steps
 * rather than creeping forward with every redraw; arriving at the lamp still
 * shows, since that is what the picture says.
 */
export function shownCarAt(carAt: number, lampAt: number | null, reduceMotion: boolean): number {
  if (!reduceMotion || (lampAt !== null && carAt >= lampAt)) return carAt;
  return Math.floor(carAt / REDUCED_MOTION_STEP + 1e-9) * REDUCED_MOTION_STEP;
}
