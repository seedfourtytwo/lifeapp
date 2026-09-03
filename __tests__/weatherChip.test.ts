/* eslint-disable import/first -- jest mock must load before the module under test */
/**
 * The header weather chip and the cache behind it.
 *
 * The chip shows an icon and a temperature and nothing else, so everything it
 * *says* to a screen reader is assembled here rather than in the component —
 * and every branch it has to cover (no forecast yet, offline with a stale
 * forecast, an outright error) is a real state a phone reaches.
 */
jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { WeatherForecastCacheSchema } from '../src/weather/forecastCache';
import { weatherChipStatus } from '../src/weather/chipStatus';
import type { WeatherDayForecast, WeatherForecast } from '../src/weather/types';

function day(overrides: Partial<WeatherDayForecast> = {}): WeatherDayForecast {
  return {
    date: '2026-07-23',
    tempMinC: 12,
    tempMaxC: 22,
    tempMeanC: 17,
    weatherCode: 3,
    condition: 'cloudy',
    precipProbabilityPct: 10,
    humidityMeanPct: 60,
    ...overrides,
  };
}

function forecast(overrides: Partial<WeatherForecast> = {}): WeatherForecast {
  return {
    currentTempC: 18.4,
    currentWeatherCode: 3,
    currentCondition: 'cloudy',
    currentHumidityPct: 61,
    precipProbabilityPct: 10,
    trend: null,
    daily: [day()],
    lat: 52.52,
    lon: 13.4,
    fetchedAt: '2026-07-23T10:00:00.000Z',
    ...overrides,
  };
}

describe('weatherChipStatus', () => {
  it('reads out condition, range, rain and trend when a forecast is in hand', () => {
    const status = weatherChipStatus({
      forecast: forecast(),
      loading: false,
      offline: false,
      error: null,
      todayIso: '2026-07-23',
    });

    expect(status.tempLabel).toBe('18°');
    expect(status.condition).toBe('cloudy');
    expect(status.hasForecast).toBe(true);
    expect(status.today?.date).toBe('2026-07-23');
    expect(status.summary).toBe(
      'Weather 18°, Cloudy. 12°/22°. Rain 10%. Steady for now',
    );
  });

  it('names the direction when the outlook is moving', () => {
    const improving = weatherChipStatus({
      forecast: forecast({ trend: 'improving' }),
      loading: false,
      offline: false,
      error: null,
      todayIso: '2026-07-23',
    });
    expect(improving.summary).toContain('Improving soon');

    const worsening = weatherChipStatus({
      forecast: forecast({ trend: 'worsening' }),
      loading: false,
      offline: false,
      error: null,
      todayIso: '2026-07-23',
    });
    expect(worsening.summary).toContain('Worsening soon');
  });

  it('picks today out of the daily rows, not just the first one', () => {
    const status = weatherChipStatus({
      forecast: forecast({
        daily: [
          day({ date: '2026-07-22', tempMinC: 1, tempMaxC: 2 }),
          day({ date: '2026-07-23', tempMinC: 12, tempMaxC: 22 }),
        ],
      }),
      loading: false,
      offline: false,
      error: null,
      todayIso: '2026-07-23',
    });
    expect(status.today?.date).toBe('2026-07-23');
    expect(status.summary).toContain('12°/22°');
  });

  it('falls back to the first row when today is not in the forecast', () => {
    const status = weatherChipStatus({
      forecast: forecast({ daily: [day({ date: '2026-07-24' })] }),
      loading: false,
      offline: false,
      error: null,
      todayIso: '2026-07-23',
    });
    expect(status.today?.date).toBe('2026-07-24');
  });

  it('keeps a stale forecast on screen while offline', () => {
    const status = weatherChipStatus({
      forecast: forecast(),
      loading: false,
      offline: true,
      error: 'No connection',
      todayIso: '2026-07-23',
    });
    expect(status.hasForecast).toBe(true);
    expect(status.tempLabel).toBe('18°');
    expect(status.stale).toBe(true);
  });

  it('says why there is nothing to show', () => {
    const base = {
      forecast: null,
      loading: false,
      offline: false,
      error: null,
      todayIso: '2026-07-23',
    };

    expect(weatherChipStatus(base).summary).toBe('Weather unavailable');
    expect(weatherChipStatus({ ...base, loading: true }).summary).toBe(
      'Loading weather',
    );
    expect(weatherChipStatus({ ...base, offline: true }).summary).toBe(
      'Weather offline',
    );
    expect(
      weatherChipStatus({ ...base, error: 'Location not set' }).summary,
    ).toBe('Location not set');
  });

  it('shows a dash instead of a temperature it does not have', () => {
    const status = weatherChipStatus({
      forecast: null,
      loading: true,
      offline: false,
      error: null,
      todayIso: '2026-07-23',
    });
    expect(status.tempLabel).toBe('—');
    expect(status.condition).toBe('other');
    expect(status.today).toBeNull();
  });
});

describe('cached forecast schema', () => {
  it('round-trips humidity', () => {
    const parsed = WeatherForecastCacheSchema.parse(
      JSON.parse(JSON.stringify(forecast())),
    );
    expect(parsed.currentHumidityPct).toBe(61);
    expect(parsed.daily[0]!.humidityMeanPct).toBe(60);
  });

  it('still parses a forecast cached before humidity existed', () => {
    const legacy = JSON.parse(JSON.stringify(forecast())) as Record<
      string,
      unknown
    >;
    delete legacy.currentHumidityPct;
    delete (
      (legacy.daily as Record<string, unknown>[])[0] as Record<string, unknown>
    ).humidityMeanPct;

    const parsed = WeatherForecastCacheSchema.parse(legacy);
    expect(parsed.currentHumidityPct ?? null).toBeNull();
    expect(parsed.daily[0]!.humidityMeanPct ?? null).toBeNull();
  });

  it('accepts an explicit null', () => {
    const withNulls = JSON.parse(JSON.stringify(forecast())) as Record<
      string,
      unknown
    >;
    withNulls.currentHumidityPct = null;
    (
      (withNulls.daily as Record<string, unknown>[])[0] as Record<string, unknown>
    ).humidityMeanPct = null;
    expect(() => WeatherForecastCacheSchema.parse(withNulls)).not.toThrow();
  });
});
