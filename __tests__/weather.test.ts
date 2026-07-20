import {
  clampBubblePosition,
  defaultBubblePosition,
} from '../src/weather/bubblePosition';
import {
  conditionIconName,
  conditionLabel,
  weatherCodeToCondition,
} from '../src/weather/codes';
import { AppSettingsSchema } from '../src/protocol/appSettings';
import {
  buildGeocodeQueries,
  formatGeocodeLabel,
} from '../src/weather/openMeteo';
import {
  classifyWeatherFetchError,
  weatherErrorMessage,
} from '../src/weather/errors';

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

  it('maps rain and thunder to rain', () => {
    expect(weatherCodeToCondition(61)).toBe('rain');
    expect(weatherCodeToCondition(80)).toBe('rain');
    expect(weatherCodeToCondition(95)).toBe('rain');
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
    expect(conditionLabel('rain')).toBe('Rain');
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

  it('provides a default corner position', () => {
    const d = defaultBubblePosition();
    expect(d.x).toBeGreaterThan(0.5);
    expect(d.y).toBeLessThan(0.5);
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
