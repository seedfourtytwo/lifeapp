/* eslint-disable import/first -- jest mock must load before the module under test */
/**
 * Humidity comes from Open-Meteo's *hourly* and *current* blocks.
 *
 * There is no daily relative-humidity variable in the API, so the per-day
 * figure the forecast panel shows has to be averaged from the hourly series
 * here. These tests pin both halves: that we ask for the variable at all, and
 * that a day's mean only counts that day's hours.
 */
jest.mock('../src/weather/fetchJson', () => ({
  fetchJsonWithTimeout: jest.fn(),
}));

import { fetchJsonWithTimeout } from '../src/weather/fetchJson';
import { fetchForecast } from '../src/weather/openMeteo';

const mockFetch = fetchJsonWithTimeout as jest.MockedFunction<
  typeof fetchJsonWithTimeout
>;

function apiResponse(overrides: Record<string, unknown> = {}) {
  return {
    latitude: 52.52,
    longitude: 13.4,
    current: {
      temperature_2m: 18.4,
      weather_code: 3,
      relative_humidity_2m: 61,
    },
    hourly: {
      time: [
        '2026-07-23T00:00',
        '2026-07-23T12:00',
        '2026-07-24T00:00',
        '2026-07-24T12:00',
      ],
      weather_code: [3, 3, 61, 61],
      precipitation_probability: [5, 10, 60, 70],
      relative_humidity_2m: [50, 70, 80, 90],
    },
    daily: {
      time: ['2026-07-23', '2026-07-24'],
      weather_code: [3, 61],
      temperature_2m_max: [22, 19],
      temperature_2m_min: [12, 11],
      temperature_2m_mean: [17, 15],
      precipitation_probability_max: [10, 70],
    },
    ...overrides,
  };
}

describe('fetchForecast humidity', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('asks Open-Meteo for hourly and current relative humidity', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    await fetchForecast(52.52, 13.4);

    const url = mockFetch.mock.calls[0]![0];
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('current')?.split(',')).toContain('relative_humidity_2m');
    expect(params.get('hourly')?.split(',')).toContain('relative_humidity_2m');
    // There is no daily humidity variable — asking for one is a 400.
    expect(params.get('daily')).not.toContain('relative_humidity');
  });

  it('reports the current humidity', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    const forecast = await fetchForecast(52.52, 13.4);
    expect(forecast.currentHumidityPct).toBe(61);
  });

  it('averages each day from that day’s hours only', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    const forecast = await fetchForecast(52.52, 13.4);
    expect(forecast.daily[0]!.humidityMeanPct).toBe(60);
    expect(forecast.daily[1]!.humidityMeanPct).toBe(85);
  });

  it('leaves humidity null when the API omits it', async () => {
    const response = apiResponse();
    delete (response.current as Record<string, unknown>).relative_humidity_2m;
    delete (response.hourly as Record<string, unknown>).relative_humidity_2m;
    mockFetch.mockResolvedValue(response);

    const forecast = await fetchForecast(52.52, 13.4);
    expect(forecast.currentHumidityPct).toBeNull();
    expect(forecast.daily[0]!.humidityMeanPct).toBeNull();
  });

  it('ignores non-finite hourly samples rather than poisoning the mean', async () => {
    const response = apiResponse();
    (response.hourly as Record<string, unknown>).relative_humidity_2m = [
      null,
      70,
      80,
      90,
    ];
    mockFetch.mockResolvedValue(response);

    const forecast = await fetchForecast(52.52, 13.4);
    expect(forecast.daily[0]!.humidityMeanPct).toBe(70);
  });

  it('clamps and rounds to whole percent', async () => {
    const response = apiResponse();
    (response.hourly as Record<string, unknown>).relative_humidity_2m = [
      -10, 33.4, 120, 100,
    ];
    (response.current as Record<string, unknown>).relative_humidity_2m = 101;
    mockFetch.mockResolvedValue(response);

    const forecast = await fetchForecast(52.52, 13.4);
    // Day one: clamp(-10)=0 and 33.4 → mean 16.7 → 17.
    expect(forecast.daily[0]!.humidityMeanPct).toBe(17);
    expect(forecast.daily[1]!.humidityMeanPct).toBe(100);
    expect(forecast.currentHumidityPct).toBe(100);
  });
});

describe('fetchDailyWeatherRange stays humidity-free', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('does not request humidity for the Insights history range', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    const { fetchDailyWeatherRange } = await import('../src/weather/openMeteo');
    await fetchDailyWeatherRange(52.52, 13.4, '2026-07-23', '2026-07-24');

    const url = mockFetch.mock.calls[0]![0];
    expect(url).not.toContain('relative_humidity');
  });
});
