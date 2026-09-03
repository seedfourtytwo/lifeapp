import {
  conditionIconName,
  conditionLabel,
  weatherCodeToCondition,
} from '../src/weather/codes';
import { AppSettingsSchema, APP_SETTING_KEYS } from '../src/protocol/appSettings';
import {
  buildGeocodeQueries,
  formatGeocodeLabel,
} from '../src/weather/openMeteo';
import {
  classifyWeatherFetchError,
  weatherErrorMessage,
} from '../src/weather/errors';
import { computeWeatherTrend } from '../src/weather/trend';

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

describe('AppSettingsSchema weather fields', () => {
  it('accepts weather settings', () => {
    const parsed = AppSettingsSchema.parse({
      weatherWidgetEnabled: true,
      weatherLocationMode: 'manual',
      weatherPlaceName: 'Berlin',
      weatherLat: 52.52,
      weatherLon: 13.4,
    });
    expect(parsed.weatherWidgetEnabled).toBe(true);
    expect(parsed.weatherLocationMode).toBe('manual');
    expect(parsed.weatherLat).toBe(52.52);
  });

  /**
   * The draggable weather bubble is gone, and with it the three settings that
   * remembered where it sat and how many corners it had hit. A backup file
   * written by an older build still carries them, and importing that file has
   * to keep working — Zod drops keys it does not know rather than refusing the
   * whole bundle.
   */
  it('drops the retired bubble keys from an older backup instead of throwing', () => {
    const parsed = AppSettingsSchema.parse({
      themeMode: 'dark',
      weatherWidgetEnabled: true,
      weatherBubbleX: 0.8,
      weatherBubbleY: 0.1,
      // Values that would have failed validation when the fields were live.
      weatherCornerScore: { date: '2026-07-23', count: 9 },
    });
    expect(parsed.themeMode).toBe('dark');
    expect(parsed.weatherWidgetEnabled).toBe(true);
    expect(parsed).not.toHaveProperty('weatherBubbleX');
    expect(parsed).not.toHaveProperty('weatherBubbleY');
    expect(parsed).not.toHaveProperty('weatherCornerScore');
  });

  it('no longer names the retired bubble settings keys', () => {
    const keys: string[] = Object.values(APP_SETTING_KEYS);
    expect(keys).not.toContain('weather_bubble_x');
    expect(keys).not.toContain('weather_bubble_y');
    expect(keys).not.toContain('weather_corner_score');
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
