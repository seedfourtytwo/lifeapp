/**
 * The header peek sheet, rendered.
 *
 * Two glyphs in the day header open the same panel shell, so the shell is the
 * thing worth rendering: a sheet that throws on mount takes both peeks with
 * it, and the weather body is where the numbers a forecast actually carries
 * either appear or quietly go missing.
 */
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import WeatherPeekSheet from '../src/components/weather/WeatherPeekSheet';
import { APP_SETTING_KEYS, AppSettingsSchema } from '../src/protocol/appSettings';
import { weatherChipStatus } from '../src/weather/chipStatus';
import type { WeatherForecast } from '../src/weather/types';

const TODAY = '2026-07-23';

function forecast(overrides: Partial<WeatherForecast> = {}): WeatherForecast {
  return {
    currentTempC: 18.4,
    currentWeatherCode: 3,
    currentCondition: 'cloudy',
    currentHumidityPct: 61,
    precipProbabilityPct: 10,
    trend: null,
    daily: [
      {
        date: TODAY,
        tempMinC: 12,
        tempMaxC: 22,
        tempMeanC: 17,
        weatherCode: 3,
        condition: 'cloudy',
        precipProbabilityPct: 10,
        humidityMeanPct: 60,
      },
      {
        date: '2026-07-24',
        tempMinC: 11,
        tempMaxC: 19,
        tempMeanC: 15,
        weatherCode: 61,
        condition: 'rain',
        precipProbabilityPct: 70,
        humidityMeanPct: null,
      },
    ],
    lat: 52.52,
    lon: 13.4,
    fetchedAt: '2026-07-23T10:00:00.000Z',
    ...overrides,
  };
}

type Node = { props?: Record<string, unknown>; children?: Node[] | null } | string | null;

/** Every string in the rendered tree, flattened. */
function texts(node: Node, found: string[] = []): string[] {
  if (node == null) return found;
  if (typeof node === 'string') {
    found.push(node);
    return found;
  }
  for (const child of node.children ?? []) texts(child, found);
  return found;
}

function renderWeatherPeek(next: WeatherForecast | null, offline = false): string[] {
  const status = weatherChipStatus({
    forecast: next,
    loading: false,
    offline,
    error: null,
    todayIso: TODAY,
  });

  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        {
          initialMetrics: {
            frame: { x: 0, y: 0, width: 400, height: 800 },
            insets: { top: 24, left: 0, right: 0, bottom: 48 },
          },
        },
        React.createElement(
          PaperProvider,
          null,
          React.createElement(WeatherPeekSheet, {
            visible: true,
            onClose: () => {},
            forecast: next,
            status,
            placeName: 'Berlin',
          }),
        ),
      ),
    );
  });
  const found = texts(tree.toJSON() as Node);
  act(() => {
    tree.unmount();
  });
  return found;
}

describe('weather peek sheet', () => {
  it('mounts and shows the forecast without repeating the date', () => {
    const found = renderWeatherPeek(forecast());
    const joined = found.join(' | ');

    expect(joined).toContain('Forecast');
    expect(joined).toContain('Berlin');
    // Now: temperature, condition, rain, humidity.
    expect(joined).toContain('18°');
    expect(joined).toContain('Humidity 61%');
    // The strip: both days' highs and lows.
    expect(found).toContain('22°');
    expect(found).toContain('12°');
    expect(found).toContain('19°');
    // Per-day humidity where there is one, and nothing where there is not.
    expect(found.filter((s) => s === '60%')).toHaveLength(1);
    // The header above the sheet already says which day this is.
    expect(joined).not.toContain('23/07');
    expect(joined).not.toContain(TODAY);
  });

  it('says why it is empty rather than rendering an empty strip', () => {
    const joined = renderWeatherPeek(null, true).join(' | ');
    expect(joined).toContain('Weather offline');
    expect(joined).not.toContain('°');
  });

  it('flags a reading kept from before the connection dropped', () => {
    const joined = renderWeatherPeek(forecast(), true).join(' | ');
    expect(joined).toContain('Last known reading');
  });
});

describe('calendar peek sheet', () => {
  it('mounts through the same shell and offers the way out to the full screen', async () => {
    const CalendarPeekSheet = (await import('../src/components/CalendarPeekSheet'))
      .default;

    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(
          SafeAreaProvider,
          {
            initialMetrics: {
              frame: { x: 0, y: 0, width: 400, height: 800 },
              insets: { top: 24, left: 0, right: 0, bottom: 48 },
            },
          },
          React.createElement(
            PaperProvider,
            null,
            React.createElement(
              NavigationContainer,
              null,
              React.createElement(CalendarPeekSheet, {
                visible: true,
                onClose: () => {},
              }),
            ),
          ),
        ),
      );
    });

    const joined = texts(tree.toJSON() as Node).join(' | ');
    act(() => {
      tree.unmount();
    });

    expect(joined).toContain('Calendar');
    // Nothing seeded, so it is the empty state — not a crash and not a blank.
    expect(joined).toContain('Nothing needing attention right now.');
    expect(joined).toContain('Open calendar');
  });
});

/**
 * The chip lives inside `DayHeader` rather than being handed in through its
 * `actions` slot, so every Home tab gets it without five call sites agreeing.
 * These render the header directly to hold that: what appears, and what the
 * weather switch takes away. The calendar glyph has no switch — it is part of
 * the header on every tab.
 */
describe('the day header chip', () => {
  function renderHeader(settings: {
    weatherWidgetEnabled: boolean;
  }): { strings: string[]; a11yLabels: string[] } {
    const { useSettingsStore } = jest.requireActual<
      typeof import('../src/store/settingsStore')
    >('../src/store/settingsStore');
    const { useWeatherStore } = jest.requireActual<
      typeof import('../src/store/weatherStore')
    >('../src/store/weatherStore');
    const DayHeader = jest.requireActual<typeof import('../src/screens/shared/DayHeader')>(
      '../src/screens/shared/DayHeader',
    ).default;

    useSettingsStore.setState({ ...settings, weatherPlaceName: 'Berlin' });
    useWeatherStore.setState({
      forecast: forecast(),
      loading: false,
      offline: false,
      error: null,
    });

    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        React.createElement(
          SafeAreaProvider,
          {
            initialMetrics: {
              frame: { x: 0, y: 0, width: 400, height: 800 },
              insets: { top: 24, left: 0, right: 0, bottom: 48 },
            },
          },
          React.createElement(
            PaperProvider,
            null,
            React.createElement(
              NavigationContainer,
              null,
              React.createElement(DayHeader, { now: new Date(2026, 6, 23, 9, 0, 0) }),
            ),
          ),
        ),
      );
    });

    const json = tree.toJSON() as Node;
    const a11yLabels: string[] = [];
    const walk = (node: Node) => {
      if (node == null || typeof node === 'string') return;
      const label = node.props?.accessibilityLabel;
      if (typeof label === 'string') a11yLabels.push(label);
      for (const child of node.children ?? []) walk(child);
    };
    walk(json);
    const strings = texts(json);
    act(() => {
      tree.unmount();
    });
    return { strings, a11yLabels };
  }

  it('puts the temperature beside the date on every tab', () => {
    const { strings, a11yLabels } = renderHeader({ weatherWidgetEnabled: true });
    expect(strings).toContain('18°');
    expect(a11yLabels.join(' | ')).toContain('Weather 18°, Cloudy');
    expect(a11yLabels).toContain('Open calendar');
  });

  it('drops the chip when weather is switched off, keeping the calendar glyph', () => {
    const { strings, a11yLabels } = renderHeader({ weatherWidgetEnabled: false });
    expect(strings).not.toContain('18°');
    expect(a11yLabels).toContain('Open calendar');
  });
});

/**
 * The calendar peek used to be behind a switch. It is not any more: it costs
 * nothing until it is tapped, and a setting whose answer is always "on" is a
 * row in Settings nobody reads. The store, the protocol key and the Settings
 * switch are all gone — what is left is a glyph nothing can take away.
 */
describe('the retired calendar widget setting', () => {
  it('no longer names a calendar widget settings key', () => {
    const keys: string[] = Object.values(APP_SETTING_KEYS);
    expect(keys).not.toContain('calendar_widget_enabled');
    // The weather chip still has a switch — this removal is not that one.
    expect(keys).toContain('weather_widget_enabled');
  });

  it('drops the retired key from an older backup instead of throwing', () => {
    const parsed = AppSettingsSchema.parse({
      themeMode: 'dark',
      weatherWidgetEnabled: true,
      calendarWidgetEnabled: false,
    });
    expect(parsed.themeMode).toBe('dark');
    expect(parsed.weatherWidgetEnabled).toBe(true);
    expect(parsed).not.toHaveProperty('calendarWidgetEnabled');
  });

  it('is not a field the settings store carries', () => {
    const { useSettingsStore } = jest.requireActual<
      typeof import('../src/store/settingsStore')
    >('../src/store/settingsStore');
    const fields = Object.keys(useSettingsStore.getState());
    expect(fields).not.toContain('calendarWidgetEnabled');
    expect(fields).not.toContain('setCalendarWidgetEnabled');
    // The weather switch is a different setting and stays.
    expect(fields).toContain('weatherWidgetEnabled');
  });
});
