/**
 * The Night road as plain shapes: the same picture the widget draws
 * (`RoadScene.kt`), and the car's place on it during a ride, worked out from
 * the clock alone.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { Circle } from 'react-native-svg';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Road } from '../src/ui/Road';
import {
  RIDE_CAR_START,
  RIDE_LAMP_AT,
  rideCarAt,
  rideProgress,
  roadPoint,
  roadScene,
  shownCarAt,
} from '../src/ui/roadScene';

const START = Date.UTC(2026, 2, 10, 20, 0);
const END = START + 600_000;

describe('ride progress', () => {
  it.each([
    ['at the start', START, 0],
    ['half way', START + 300_000, 0.5],
    ['at the end', END, 1],
    ['before the start (a clock set back)', START - 60_000, 0],
    ['long after the end', END + 3_600_000, 1],
  ])('%s', (_label, now, expected) => {
    expect(rideProgress(START, END, now)).toBeCloseTo(expected);
  });

  it('is over for a ride with no length', () => {
    expect(rideProgress(START, START, START)).toBe(1);
  });
});

describe("the car's place during a ride", () => {
  it('starts near, ends at the lamp, and is half way between at half time', () => {
    expect(rideCarAt(0)).toBe(RIDE_CAR_START);
    expect(rideCarAt(0.5)).toBeCloseTo((RIDE_CAR_START + RIDE_LAMP_AT) / 2);
    expect(rideCarAt(1)).toBe(RIDE_LAMP_AT);
  });

  it('stays on the stretch outside 0–100 %', () => {
    expect(rideCarAt(-0.5)).toBe(RIDE_CAR_START);
    expect(rideCarAt(1.5)).toBe(RIDE_LAMP_AT);
  });

  it('drives away from the viewer: higher and smaller as the ride goes on', () => {
    const [start, half, end] = [0, 0.5, 1].map((p) => roadScene({ carAt: rideCarAt(p), lampAt: RIDE_LAMP_AT }));
    expect(half!.tailLights[0].cy).toBeLessThan(start!.tailLights[0].cy);
    expect(end!.tailLights[0].cy).toBeLessThan(half!.tailLights[0].cy);
    expect(end!.tailLights[0].r).toBeLessThan(start!.tailLights[0].r);
  });

  it('stands level with the lamp at the end of the ride', () => {
    const scene = roadScene({ carAt: rideCarAt(1), lampAt: RIDE_LAMP_AT });
    expect(scene.lamp!.post.y1).toBeCloseTo(roadPoint(RIDE_LAMP_AT).y);
    expect(roadPoint(rideCarAt(1)).y).toBeCloseTo(scene.lamp!.post.y1);
  });
});

describe('the road', () => {
  it('runs from the full width at its near edge to a point at the horizon', () => {
    const near = roadPoint(0);
    const far = roadPoint(1);
    expect(near.y).toBeGreaterThan(far.y);
    expect(near.half).toBeGreaterThan(100);
    expect(far.half).toBe(0);
  });

  it('clamps a point off either end of the road', () => {
    expect(roadPoint(-1)).toEqual(roadPoint(0));
    expect(roadPoint(2)).toEqual(roadPoint(1));
  });

  it('draws a dash for each day behind the car, none for a day that does not count', () => {
    const scene = roadScene({ carAt: 0.6, lampAt: null, dashes: [null, 0.16, 1, 1] });
    expect(scene.dashes.map((dash) => dash.level)).toEqual([0.16, 1, 1]);
    for (const dash of scene.dashes) {
      expect(dash.y1).toBeGreaterThan(roadPoint(0.6).y);
    }
    expect(scene.lamp).toBeNull();
  });

  it('puts two tail lights side by side on the car', () => {
    const [left, right] = roadScene({ carAt: 0.5 }).tailLights;
    expect(left.cy).toBe(right.cy);
    expect(left.cx).toBeLessThan(right.cx);
    expect((left.cx + right.cx) / 2).toBeCloseTo(roadPoint(0.5).x);
  });
});

describe('under reduced motion', () => {
  it('moves the car in whole steps instead of creeping every second', () => {
    expect(shownCarAt(0.312, RIDE_LAMP_AT, true)).toBeCloseTo(0.3);
    expect(shownCarAt(0.349, RIDE_LAMP_AT, true)).toBeCloseTo(0.3);
    expect(shownCarAt(0.351, RIDE_LAMP_AT, true)).toBeCloseTo(0.35);
  });

  it('still shows the car at the lamp once it gets there', () => {
    expect(shownCarAt(RIDE_LAMP_AT, RIDE_LAMP_AT, true)).toBe(RIDE_LAMP_AT);
  });

  it('leaves the car where the clock puts it otherwise', () => {
    expect(shownCarAt(0.312, RIDE_LAMP_AT, false)).toBe(0.312);
  });
});

describe('the Road drawing', () => {
  async function tailLightsDrawn(reduceMotion: boolean, carAt: number) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        React.createElement(Road, { carAt, lampAt: RIDE_LAMP_AT, accessibilityLabel: 'Road' }),
      );
    });
    const circles = tree.root.findAllByType(Circle).map((node) => node.props.cy as number);
    act(() => tree.unmount());
    // The lamp is drawn before the car.
    return circles.slice(1);
  }

  afterEach(() => jest.restoreAllMocks());

  it('draws the car where the clock puts it', async () => {
    const cy = roadScene({ carAt: 0.312, lampAt: RIDE_LAMP_AT }).tailLights[0].cy;
    expect(await tailLightsDrawn(false, 0.312)).toEqual([cy, cy]);
  });

  it('asks the phone about reduced motion and moves the car in steps', async () => {
    const cy = roadScene({ carAt: 0.3, lampAt: RIDE_LAMP_AT }).tailLights[0].cy;
    expect(await tailLightsDrawn(true, 0.312)).toEqual([cy, cy]);
  });
});
