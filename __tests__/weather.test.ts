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
import { appendMotionSample, stepBubblePhysics, velocityFromSamples } from '../src/weather/bubblePhysics';

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

  it('uses a smaller chip size for calendar-only bounds', () => {
    const weather = clampBubblePosition(1, 0.5, layout);
    const calOnly = clampBubblePosition(1, 0.5, layout, { width: 64, height: 72 });
    expect(calOnly.x).toBeGreaterThan(weather.x);
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
    const { state } = stepBubblePhysics(
      { x: 195, y: 100, vx: 400, vy: 0 },
      bounds,
      1 / 60,
      { friction: 0, restitution: 0.8, minSpeed: 1 },
    );
    expect(state.x).toBe(bounds.maxX);
    expect(state.vx).toBeLessThan(0);
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
});

describe('velocityFromSamples', () => {
  it('scales with faster motion over the same window', () => {
    const slow = velocityFromSamples([
      { t: 1000, x: 0, y: 0 },
      { t: 1080, x: 40, y: 0 },
    ]);
    const fast = velocityFromSamples([
      { t: 1000, x: 0, y: 0 },
      { t: 1080, x: 160, y: 0 },
    ]);
    expect(fast.vx).toBeGreaterThan(slow.vx * 3);
  });
});

describe('appendMotionSample', () => {
  it('trims by age and max length', () => {
    const samples: { t: number; x: number; y: number }[] = [];
    for (let i = 0; i < 30; i++) {
      appendMotionSample(samples, { t: 1000 + i * 10, x: i, y: 0 });
    }
    expect(samples.length).toBeLessThanOrEqual(24);
    expect(samples[samples.length - 1]!.x).toBe(29);
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
