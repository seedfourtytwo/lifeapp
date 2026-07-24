import {
  clampBubblePosition,
  defaultBubblePosition,
} from '../src/weather/bubblePosition';
import {
  conditionIconName,
  conditionLabel,
  weatherCodeToCondition,
} from '../src/weather/codes';
import { formatBubbleDate, formatBubbleDateFromIso } from '../src/weather/format';
import { AppSettingsSchema } from '../src/protocol/appSettings';
import {
  buildGeocodeQueries,
  formatGeocodeLabel,
} from '../src/weather/openMeteo';
import {
  classifyWeatherFetchError,
  weatherErrorMessage,
} from '../src/weather/errors';
import { computeWeatherTrend } from '../src/weather/trend';
import { bumpCornerScore, cornerCountForDay } from '../src/weather/cornerScore';
import {
  appendMotionSample,
  BUBBLE_CHARGE_TAP_MAX,
  BUBBLE_FLING_THRESHOLD,
  BUBBLE_FRICTION,
  BUBBLE_RESTITUTION,
  BUBBLE_TRAVEL_FLICK_PX,
  BUBBLE_TRAVEL_FULL_PX,
  composeBubbleThrow,
  cornerIdFromEdges,
  releaseSpeedForCharge,
  resolveBubbleRelease,
  speedForTravel,
  stepBubblePhysics,
  travelBudgetForCharge,
  velocityFromSamples,
} from '../src/weather/bubblePhysics';

describe('weatherCodeToCondition', () => {
  it('maps clear codes to sunny', () => {
    expect(weatherCodeToCondition(0)).toBe('sunny');
    expect(weatherCodeToCondition(1)).toBe('sunny');
  });

  it('maps cloudy and fog to cloudy', () => {
    expect(weatherCodeToCondition(2)).toBe('cloudy');
    expect(weatherCodeToCondition(3)).toBe('cloudy');
    expect(weatherCodeToCondition(45)).toBe('cloudy');
  });

  it('maps rain and showers to rain', () => {
    expect(weatherCodeToCondition(61)).toBe('rain');
    expect(weatherCodeToCondition(80)).toBe('rain');
    expect(weatherCodeToCondition(65)).toBe('rain');
    expect(weatherCodeToCondition(82)).toBe('rain');
  });

  it('maps thunder to storm', () => {
    expect(weatherCodeToCondition(95)).toBe('storm');
    expect(weatherCodeToCondition(99)).toBe('storm');
  });

  it('maps snow codes to snow', () => {
    expect(weatherCodeToCondition(71)).toBe('snow');
    expect(weatherCodeToCondition(85)).toBe('snow');
  });

  it('falls back to other', () => {
    expect(weatherCodeToCondition(999)).toBe('other');
  });
});

describe('condition helpers', () => {
  it('returns icons and labels', () => {
    expect(conditionIconName('sunny')).toBe('weather-sunny');
    expect(conditionIconName('storm')).toBe('weather-lightning-rainy');
    expect(conditionLabel('rain')).toBe('Rain');
    expect(conditionLabel('storm')).toBe('Storm');
  });
});

describe('formatBubbleDate', () => {
  it('formats zero-padded DD/MM', () => {
    expect(formatBubbleDate(new Date(2026, 5, 22))).toBe('22/06');
    expect(formatBubbleDateFromIso('2026-07-03')).toBe('03/07');
  });
});

describe('clampBubblePosition', () => {
  const layout = { width: 400, height: 800, topInset: 40, bottomInset: 80 };

  it('keeps position within safe bounds', () => {
    const out = clampBubblePosition(0, 0, layout);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeGreaterThan(0);

    const far = clampBubblePosition(1.5, 1.5, layout);
    expect(far.x).toBeLessThan(1);
    expect(far.y).toBeLessThan(1);
  });

  it('clamps further in when the chip is smaller', () => {
    const weather = clampBubblePosition(1, 0.5, layout);
    const smaller = clampBubblePosition(1, 0.5, layout, { width: 64, height: 72 });
    expect(smaller.x).toBeGreaterThan(weather.x);
  });

  it('provides a default corner position', () => {
    const d = defaultBubblePosition();
    expect(d.x).toBeGreaterThan(0.5);
    expect(d.y).toBeLessThan(0.5);
  });
});

describe('computeWeatherTrend', () => {
  const base = new Date('2026-07-23T12:00:00');

  it('returns worsening when precip climbs over the rest of today', () => {
    const trend = computeWeatherTrend(
      [
        { time: '2026-07-23T12:00', weatherCode: 0, precipProbabilityPct: 10 },
        { time: '2026-07-23T13:00', weatherCode: 0, precipProbabilityPct: 35 },
        { time: '2026-07-23T14:00', weatherCode: 61, precipProbabilityPct: 40 },
        { time: '2026-07-23T15:00', weatherCode: 61, precipProbabilityPct: 45 },
        { time: '2026-07-24T10:00', weatherCode: 0, precipProbabilityPct: 5 },
      ],
      base,
    );
    expect(trend).toBe('worsening');
  });

  it('returns improving when severity eases later today', () => {
    const trend = computeWeatherTrend(
      [
        { time: '2026-07-23T12:00', weatherCode: 95, precipProbabilityPct: 70 },
        { time: '2026-07-23T13:00', weatherCode: 3, precipProbabilityPct: 40 },
        { time: '2026-07-23T14:00', weatherCode: 1, precipProbabilityPct: 20 },
        { time: '2026-07-23T15:00', weatherCode: 0, precipProbabilityPct: 10 },
      ],
      base,
    );
    expect(trend).toBe('improving');
  });

  it('returns null when outlook is flat', () => {
    const trend = computeWeatherTrend(
      [
        { time: '2026-07-23T12:00', weatherCode: 1, precipProbabilityPct: 10 },
        { time: '2026-07-23T13:00', weatherCode: 1, precipProbabilityPct: 12 },
        { time: '2026-07-23T14:00', weatherCode: 2, precipProbabilityPct: 15 },
      ],
      base,
    );
    expect(trend).toBeNull();
  });
});

describe('stepBubblePhysics', () => {
  const bounds = { minX: 0, maxX: 200, minY: 0, maxY: 400 };

  it('bounces off the right edge with reversed velocity', () => {
    const { state, wallHit } = stepBubblePhysics(
      { x: 195, y: 100, vx: 400, vy: 0 },
      bounds,
      1 / 60,
      { friction: 0, restitution: 0.8, minSpeed: 1 },
    );
    expect(state.x).toBe(bounds.maxX);
    expect(state.vx).toBeLessThan(0);
    expect(wallHit).toBe(true);
  });

  it('settles when speed drops below the floor', () => {
    const { settled, state } = stepBubblePhysics(
      { x: 50, y: 50, vx: 10, vy: 0 },
      bounds,
      1 / 60,
      { friction: 0, restitution: 0.8, minSpeed: 40 },
    );
    expect(settled).toBe(true);
    expect(state.vx).toBe(0);
  });

  it('flags a DVD corner hit when both axes bounce from a fling', () => {
    const { cornerHit } = stepBubblePhysics(
      { x: 195, y: 395, vx: 600, vy: 600 },
      bounds,
      1 / 60,
      {
        friction: 0,
        restitution: 0.5,
        minSpeed: 1,
        cornerMinSpeed: 200,
        cornerProximityPx: 20,
        cornerMinAxisRatio: 0.3,
      },
    );
    expect(cornerHit).toBe(true);
  });

  it('does not flag a corner on a single-wall bounce', () => {
    const { cornerHit } = stepBubblePhysics(
      { x: 195, y: 100, vx: 600, vy: 0 },
      bounds,
      1 / 60,
      { friction: 0, restitution: 0.5, minSpeed: 1, cornerMinSpeed: 200 },
    );
    expect(cornerHit).toBe(false);
  });

  it('does not flag a far diagonal that only clips both walls in one step', () => {
    const { cornerHit } = stepBubblePhysics(
      { x: 100, y: 100, vx: 8000, vy: 8000 },
      bounds,
      1 / 60,
      {
        friction: 0,
        restitution: 0.5,
        minSpeed: 1,
        cornerMinSpeed: 200,
        cornerProximityPx: 14,
      },
    );
    expect(cornerHit).toBe(false);
  });

  it('does not score a wall-scrape that only clips the second axis', () => {
    // Mostly horizontal into the BR pocket — dual clamp possible, not a DVD corner.
    const { cornerHit, wallHit } = stepBubblePhysics(
      { x: 195, y: 395, vx: 900, vy: 120 },
      bounds,
      1 / 60,
      {
        friction: 0,
        restitution: 0.5,
        minSpeed: 1,
        cornerMinSpeed: 200,
        cornerProximityPx: 20,
        cornerMinAxisRatio: 0.48,
        cornerMinAxisSpeed: 200,
      },
    );
    expect(wallHit).toBe(true);
    expect(cornerHit).toBe(false);
  });

  it('rejects a shallow diagonal even when both walls clamp', () => {
    const { cornerHit } = stepBubblePhysics(
      { x: 198, y: 398, vx: 1000, vy: 350 },
      bounds,
      1 / 60,
      {
        friction: 0,
        restitution: 0.5,
        minSpeed: 1,
        cornerMinSpeed: 500,
        cornerProximityPx: 8,
        cornerMinAxisRatio: 0.48,
        cornerMinAxisSpeed: 300,
      },
    );
    expect(cornerHit).toBe(false);
  });
});

describe('velocityFromSamples', () => {
  it('scales with faster motion over the same window', () => {
    const slow = velocityFromSamples(
      [
        { t: 1000, x: 0, y: 0 },
        { t: 1080, x: 40, y: 0 },
      ],
      1080,
    );
    const fast = velocityFromSamples(
      [
        { t: 1000, x: 0, y: 0 },
        { t: 1080, x: 160, y: 0 },
      ],
      1080,
    );
    expect(fast.vx).toBeGreaterThan(slow.vx * 3);
  });

  it('uses peak tip speed, not the slow start of an accelerating flick', () => {
    const accelerating = velocityFromSamples(
      [
        { t: 1000, x: 0, y: 0 },
        { t: 1040, x: 20, y: 0 }, // 500 px/s
        { t: 1080, x: 100, y: 0 }, // 2000 px/s tip
      ],
      1080,
      120,
    );
    // End-to-end average would be ~1250; peak tip is 2000.
    expect(accelerating.vx).toBeGreaterThan(1800);
  });
});

describe('charge travel budgets', () => {
  it('maps empty and full charge to intended coast distances', () => {
    expect(travelBudgetForCharge(0)).toBe(BUBBLE_TRAVEL_FLICK_PX);
    expect(travelBudgetForCharge(1)).toBe(BUBBLE_TRAVEL_FULL_PX);
    expect(releaseSpeedForCharge(0)).toBeCloseTo(speedForTravel(BUBBLE_TRAVEL_FLICK_PX), 5);
  });

  it('scales power smoothly with fill (monotonic, continuous)', () => {
    const a = travelBudgetForCharge(0.25);
    const b = travelBudgetForCharge(0.5);
    const c = travelBudgetForCharge(0.75);
    expect(a).toBeGreaterThan(BUBBLE_TRAVEL_FLICK_PX);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(BUBBLE_TRAVEL_FULL_PX);
    // Mid fill is already in the multi-corner band (not announced as a tier).
    expect(b).toBeGreaterThan(1100);
  });

  it('keeps flick local while mid/full can sustain a long DVD line', () => {
    const flick = releaseSpeedForCharge(0);
    const mid = releaseSpeedForCharge(0.5);
    const full = releaseSpeedForCharge(1);
    expect(mid).toBeGreaterThan(flick * 3);
    expect(full).toBeGreaterThan(mid);
    // Flick coasts less than a short-axis crossing.
    expect(flick / BUBBLE_FRICTION).toBeLessThan(280);
    // Mid+ already clears a phone diagonal with margin for 3 corners.
    expect(mid / BUBBLE_FRICTION).toBeGreaterThan(1100);
    expect(full / BUBBLE_FRICTION).toBeGreaterThan(1600);
  });
});

describe('composeBubbleThrow', () => {
  it('lets charge dominate energy while flick only nudges within the budget', () => {
    const softFlick = composeBubbleThrow(400, 0, 0);
    const hardFlick = composeBubbleThrow(2000, 0, 0);
    const halfCharge = composeBubbleThrow(800, 0, 0.5);
    const fullCharge = composeBubbleThrow(800, 0, 1);

    expect(hardFlick.vx).toBeGreaterThan(softFlick.vx);
    expect(hardFlick.vx).toBeLessThan(releaseSpeedForCharge(0) * 1.2);
    expect(halfCharge.vx).toBeGreaterThan(hardFlick.vx * 1.5);
    expect(fullCharge.vx).toBeGreaterThan(halfCharge.vx);
    expect(fullCharge.vx / halfCharge.vx).toBeLessThan(1.35); // mid already near the top band
  });

  it('launches along aim when still but charged', () => {
    const { vx, vy } = composeBubbleThrow(0, 0, 1, { x: 1, y: 0 });
    expect(vx).toBeGreaterThan(BUBBLE_FLING_THRESHOLD);
    expect(Math.abs(vy)).toBeLessThan(1);
  });

  it('does not launch a still finger with tiny charge', () => {
    const { vx, vy } = composeBubbleThrow(0, 0, 0.1, { x: 1, y: 0 });
    expect(vx).toBe(0);
    expect(vy).toBe(0);
  });
});

describe('cornerIdFromEdges', () => {
  it('maps dual edges to a corner id', () => {
    expect(cornerIdFromEdges({ left: true, right: false, top: true, bottom: false })).toBe('tl');
    expect(cornerIdFromEdges({ left: false, right: true, top: false, bottom: true })).toBe('br');
    expect(cornerIdFromEdges({ left: true, right: false, top: false, bottom: false })).toBeNull();
  });
});

describe('resolveBubbleRelease', () => {
  it('treats a short unmoved press as a tap', () => {
    expect(
      resolveBubbleRelease({
        moved: false,
        fingerVx: 0,
        fingerVy: 0,
        charge: BUBBLE_CHARGE_TAP_MAX - 0.01,
      }).kind,
    ).toBe('tap');
  });

  it('places on a slow uncommitted drag', () => {
    const r = resolveBubbleRelease({
      moved: true,
      fingerVx: 90,
      fingerVy: 0,
      charge: 0.1,
      aim: { x: 40, y: 0 },
    });
    expect(r.kind).toBe('place');
    expect(r.vx).toBe(0);
  });

  it('flings when held still with enough charge along aim', () => {
    const r = resolveBubbleRelease({
      moved: true,
      fingerVx: 0,
      fingerVy: 0,
      charge: 0.8,
      aim: { x: 1, y: 0 },
    });
    expect(r.kind).toBe('fling');
    expect(r.vx).toBeGreaterThan(BUBBLE_FLING_THRESHOLD);
  });

  it('keeps committed charge power after a gentle aim move', () => {
    // Charge → move to aim → slow release must still throw (not place).
    const r = resolveBubbleRelease({
      moved: true,
      fingerVx: 120,
      fingerVy: 30,
      charge: 0.9,
      aim: { x: 50, y: 10 },
    });
    expect(r.kind).toBe('fling');
    expect(Math.hypot(r.vx, r.vy)).toBeGreaterThan(BUBBLE_FLING_THRESHOLD);
  });

  it('flings on a fast flick', () => {
    const r = resolveBubbleRelease({
      moved: true,
      fingerVx: 900,
      fingerVy: 0,
      charge: 0,
    });
    expect(r.kind).toBe('fling');
    expect(r.vx).toBeGreaterThan(0);
  });
});

describe('corner restitution', () => {
  const bounds = { minX: 0, maxX: 200, minY: 0, maxY: 400 };

  it('kicks harder on a true corner than a single-wall bounce', () => {
    const wall = stepBubblePhysics(
      { x: 195, y: 100, vx: 600, vy: 0 },
      bounds,
      1 / 60,
      { friction: 0, restitution: BUBBLE_RESTITUTION, minSpeed: 1 },
    );
    const corner = stepBubblePhysics(
      { x: 195, y: 395, vx: 600, vy: 600 },
      bounds,
      1 / 60,
      {
        friction: 0,
        restitution: BUBBLE_RESTITUTION,
        cornerRestitutionScale: 1.5,
        minSpeed: 1,
        cornerMinSpeed: 200,
        cornerProximityPx: 20,
      },
    );
    expect(Math.abs(corner.state.vx)).toBeGreaterThan(Math.abs(wall.state.vx) * 1.35);
    expect(corner.cornerHit).toBe(true);
  });
});

describe('appendMotionSample', () => {
  it('trims by age and max length', () => {
    const samples: { t: number; x: number; y: number }[] = [];
    for (let i = 0; i < 40; i++) {
      appendMotionSample(samples, { t: 1000 + i * 10, x: i, y: 0 });
    }
    expect(samples.length).toBeLessThanOrEqual(32);
    expect(samples[samples.length - 1]!.x).toBe(39);
  });
});

describe('cornerScore', () => {
  it('resets the count on a new calendar day', () => {
    expect(cornerCountForDay({ date: '2026-07-22', count: 7 }, '2026-07-23')).toBe(0);
    expect(cornerCountForDay({ date: '2026-07-23', count: 7 }, '2026-07-23')).toBe(7);
  });

  it('bumps within the day and rolls over at midnight', () => {
    expect(bumpCornerScore(null, '2026-07-23')).toEqual({ date: '2026-07-23', count: 1 });
    expect(bumpCornerScore({ date: '2026-07-23', count: 2 }, '2026-07-23')).toEqual({
      date: '2026-07-23',
      count: 3,
    });
    expect(bumpCornerScore({ date: '2026-07-22', count: 9 }, '2026-07-23')).toEqual({
      date: '2026-07-23',
      count: 1,
    });
  });
});

describe('AppSettingsSchema weather fields', () => {
  it('accepts weather settings', () => {
    const parsed = AppSettingsSchema.parse({
      weatherWidgetEnabled: true,
      weatherLocationMode: 'manual',
      weatherPlaceName: 'Berlin',
      weatherLat: 52.52,
      weatherLon: 13.4,
      weatherBubbleX: 0.8,
      weatherBubbleY: 0.1,
    });
    expect(parsed.weatherWidgetEnabled).toBe(true);
    expect(parsed.weatherLocationMode).toBe('manual');
    expect(parsed.weatherLat).toBe(52.52);
  });

  it('rejects invalid bubble coords', () => {
    expect(() => AppSettingsSchema.parse({ weatherBubbleX: 1.5 })).toThrow();
  });
});

describe('geocode query helpers', () => {
  it('formats place labels', () => {
    expect(
      formatGeocodeLabel({
        name: 'Munich',
        admin1: 'Bavaria',
        country: 'Germany',
      }),
    ).toBe('Munich, Bavaria, Germany');
  });

  it('builds fallback queries for City Country and commas', () => {
    expect(buildGeocodeQueries('Paris France')).toEqual(['Paris France', 'Paris']);
    expect(buildGeocodeQueries('Lyon, France')).toEqual([
      'Lyon, France',
      'Lyon',
      'Lyon France',
    ]);
  });
});

describe('weather error classification', () => {
  it('treats network failures as offline', () => {
    expect(classifyWeatherFetchError(new TypeError('Network request failed'))).toBe(
      'offline',
    );
    expect(classifyWeatherFetchError(new Error('Request timed out'))).toBe('offline');
    expect(weatherErrorMessage('offline')).toBe('No connection');
  });

  it('classifies http and invalid payloads', () => {
    expect(classifyWeatherFetchError(new Error('Forecast failed (500)'))).toBe('http');
    expect(
      classifyWeatherFetchError(new Error('Forecast response missing current or daily data')),
    ).toBe('invalid');
  });
});
