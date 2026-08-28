/* eslint-disable import/first -- jest mocks must load before module imports */
import {
  reloadStoresAfterImport,
  type ReloadStoresOptions,
} from '../src/utils/reloadStoresAfterImport';
import { getDataGeneration, resetDataGenerationsForTests } from '../src/db/dataGeneration';
import { useCalendarStore } from '../src/store/calendarStore';
import { useElementStore } from '../src/store/elementStore';
import { useEventStore } from '../src/store/eventStore';
import { useFoodStore } from '../src/store/foodStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTodoStore } from '../src/store/todoStore';
import { useWeatherStore } from '../src/store/weatherStore';
import { createActiveTimerSession, PROTOCOL_VERSION } from '../src/protocol';
import { currentAppCalendarDate } from '../src/utils/dayRollover';
import { startOfWeekDate } from '../src/utils/dates';
import type { Todo } from '../src/protocol';
import type { WeatherForecast } from '../src/weather/types';

/** Ordered log of the cross-store side effects whose sequence is load-bearing. */
const mockCalls: string[] = [];

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(async () => ({
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
  })),
}));

jest.mock('../src/audio/habitTimerSound', () => ({
  stopHabitSound: jest.fn(async () => {
    mockCalls.push('stopHabitSound');
  }),
}));

jest.mock('../src/audio/preloadConfiguredHabitSounds', () => ({
  preloadConfiguredHabitSounds: jest.fn(async () => {
    mockCalls.push('preloadConfiguredHabitSounds');
  }),
}));

jest.mock('../src/notifications/calendarReminders', () => ({
  cancelCalendarReminders: jest.fn(async () => {
    mockCalls.push('cancelCalendarReminders');
  }),
  isNotificationsNativeAvailable: jest.fn(() => false),
  syncCalendarReminders: jest.fn(async () => undefined),
}));

jest.mock('../src/weather/forecastCache', () => ({
  WEATHER_FORECAST_CACHE_KEY: 'weather_last_forecast',
  clearCachedForecast: jest.fn(async () => {
    mockCalls.push('clearCachedForecast');
  }),
  loadCachedForecast: jest.fn(async () => null),
  saveCachedForecast: jest.fn(async () => true),
}));

jest.mock('../src/i18n', () => {
  const actual = jest.requireActual('../src/i18n');
  return {
    ...actual,
    applyAppLanguage: jest.fn(async () => {
      mockCalls.push('applyAppLanguage');
      return 'en';
    }),
  };
});

jest.mock('../src/nutrition/seedCatalog', () => ({
  syncSeedFoodCatalog: jest.fn(async () => undefined),
}));

jest.mock('../src/db/repositories/elementRepository', () => ({
  getAllElements: jest.fn(async () => {
    mockCalls.push('elementLoad');
    return [];
  }),
}));

jest.mock('../src/db/repositories/dashboardRepository', () => ({
  getDashboardItems: jest.fn(async () => []),
  getNextSortOrder: jest.fn(async () => 0),
  deleteDashboardItem: jest.fn(async () => undefined),
  insertDashboardItemIfAbsent: jest.fn(async () => true),
  setDashboardSortOrders: jest.fn(async () => undefined),
}));

jest.mock('../src/db/repositories/eventRepository', () => ({
  getDailyTotalsForElementsOnDate: jest.fn(async () => new Map()),
  getEventsForElementsOnDate: jest.fn(async () => new Map()),
}));

jest.mock('../src/db/repositories/activeTimerRepository', () => ({
  loadPersistedActiveTimerSessions: jest.fn(async () => ({})),
  persistActiveTimerSessions: jest.fn(async () => undefined),
  clearPersistedActiveTimerSessions: jest.fn(async () => undefined),
}));

jest.mock('../src/db/repositories/calendarRepository', () => ({
  ensureDefaultCalendar: jest.fn(async () => ({
    id: 'cal-default',
    name: 'Personal',
    color: '#3D7EA6',
    source: 'local',
  })),
  getAllCalendars: jest.fn(async () => {
    mockCalls.push('calendarLoad');
    return [];
  }),
  getAllEvents: jest.fn(async () => []),
  getAllReminders: jest.fn(async () => []),
  getAllOccurrenceClears: jest.fn(async () => []),
}));

jest.mock('../src/db/repositories/settingsRepository', () => ({
  getSetting: jest.fn(async () => null),
  getSettings: jest.fn(async () => {
    mockCalls.push('settingsLoad');
    return new Map<string, string | null>();
  }),
  setSetting: jest.fn(async () => undefined),
  deleteSetting: jest.fn(async () => undefined),
}));

jest.mock('../src/db/repositories/foodRepository', () => ({
  getAllFoodItems: jest.fn(async () => {
    mockCalls.push('foodLoad');
    return [];
  }),
  getFoodLogForDates: jest.fn(async () => []),
}));

const openTodo: Todo = {
  id: 'todo-open',
  title: 'Survives a definitions clear',
  note: null,
  dueDate: null,
  completedAt: null,
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
};

jest.mock('../src/db/repositories/todoRepository', () => ({
  getOpenTodos: jest.fn(async () => {
    mockCalls.push('todoLoad');
    return [
      {
        id: 'todo-open',
        title: 'Survives a definitions clear',
        note: null,
        dueDate: null,
        completedAt: null,
        sortOrder: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        protocolVersion: 1,
      },
    ];
  }),
}));

const staleForecast = {
  lat: 1,
  lon: 2,
  fetchedAt: '2025-01-01T00:00:00.000Z',
  current: null,
  daily: [],
} as unknown as WeatherForecast;

const staleTodo: Todo = { ...openTodo, id: 'todo-stale', title: 'Pre-clear todo' };

const mockRefresh = jest.fn(async () => undefined);

type ClearedScopes = NonNullable<ReloadStoresOptions['cleared']>;

/** The clear sheet always sends the whole plan, so spell out the untouched scopes. */
function cleared(partial: Partial<ClearedScopes>): ClearedScopes {
  return {
    calendar: false,
    weather: false,
    preferences: false,
    definitions: false,
    activityHistory: false,
    ...partial,
  };
}

/** Fill every mirror with pre-clear junk so a surviving field is visible. */
function seedStores(): void {
  useEventStore.setState({
    dailyTotals: { 'counter-1': 5 },
    habitDoneToday: { 'habit-1': true },
    habitStreaks: { 'habit-1': 3 },
    habitFailureStreaks: { 'habit-1': 1 },
    counterStreaks: { 'counter-1': 2 },
    activeTimerSessions: { 'habit-1': createActiveTimerSession(new Date()) },
    dayStateReady: true,
    counterTotalsReady: true,
  });

  useCalendarStore.setState({
    calendars: [{ id: 'cal-1', name: 'Old', color: '#000', source: 'local' }],
    events: [],
    reminders: [],
    clearedByKey: {
      'occ-1': {
        occurrenceKey: 'occ-1',
        eventId: 'evt-1',
        clearedAt: '2025-01-01T00:00:00.000Z',
      },
    },
    isLoaded: true,
  });

  useWeatherStore.setState({
    forecast: staleForecast,
    loading: true,
    error: 'stale',
    offline: true,
    lastFetchAt: 1234,
    refresh: mockRefresh,
  });

  useFoodStore.setState({
    items: [
      {
        id: 'food-1',
        name: 'Pre-clear food',
        slug: 'pre-clear-food',
        group: 'other',
        archivedAt: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
      },
    ],
    weekEntries: [],
    weekStart: '2020-01-06',
    loaded: true,
    error: 'stale',
  });

  useTodoStore.setState({ todos: [staleTodo], loaded: true, error: 'stale' });

  useElementStore.setState({ elements: [], dashboard: [], isLoaded: false });

  useSettingsStore.setState({ themeMode: 'dark', isLoaded: true });
}

describe('reloadStoresAfterImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalls.length = 0;
    resetDataGenerationsForTests();
    seedStores();
  });

  describe('full replace (import)', () => {
    it('defaults to a full replace when called with no options', async () => {
      await reloadStoresAfterImport();

      expect(useEventStore.getState().dailyTotals).toEqual({});
      expect(useCalendarStore.getState().calendars).toEqual([]);
      expect(useWeatherStore.getState().forecast).toBeNull();
      expect(mockCalls).toContain('settingsLoad');
    });

    it('blanks every event mirror field and re-marks the ready flags', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      const event = useEventStore.getState();
      expect(event.dailyTotals).toEqual({});
      expect(event.habitDoneToday).toEqual({});
      expect(event.habitStreaks).toEqual({});
      expect(event.habitFailureStreaks).toEqual({});
      expect(event.counterStreaks).toEqual({});
      expect(event.activeTimerSessions).toEqual({});
      // Empty element inputs still flip the ready flags back to true.
      expect(event.dayStateReady).toBe(true);
      expect(event.counterTotalsReady).toBe(true);
    });

    it('blanks calendar state, cancels reminders, then reloads', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      const calendar = useCalendarStore.getState();
      expect(calendar.calendars).toEqual([]);
      expect(calendar.events).toEqual([]);
      expect(calendar.reminders).toEqual([]);
      expect(calendar.clearedByKey).toEqual({});
      expect(calendar.isLoaded).toBe(true);
      expect(mockCalls.indexOf('cancelCalendarReminders')).toBeLessThan(
        mockCalls.indexOf('calendarLoad'),
      );
    });

    it('clears weather state and the cached forecast', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      const weather = useWeatherStore.getState();
      expect(weather.forecast).toBeNull();
      expect(weather.loading).toBe(false);
      expect(weather.error).toBeNull();
      expect(weather.offline).toBe(false);
      expect(weather.lastFetchAt).toBeNull();
      expect(mockCalls).toContain('clearCachedForecast');
    });

    it('drops the loaded-week guard and refetches the current week', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      const food = useFoodStore.getState();
      expect(food.items).toEqual([]);
      expect(food.weekEntries).toEqual([]);
      expect(food.error).toBeNull();
      expect(food.loaded).toBe(true);
      expect(food.weekStart).toBe(startOfWeekDate(currentAppCalendarDate()));
      expect(mockCalls).toContain('foodLoad');
    });

    it('refetches open todos rather than blanking them', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      expect(useTodoStore.getState().todos).toEqual([openTodo]);
    });

    it('bumps the protocol, catalog, todo and journal generations', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      expect(getDataGeneration('protocol')).toBe(1);
      expect(getDataGeneration('catalog')).toBe(1);
      expect(getDataGeneration('todos')).toBe(1);
      expect(getDataGeneration('journal')).toBe(1);
      // Weather is bumped by the weather store's own clear; calendar is not
      // bumped here at all — the clear/import path already did that.
      expect(getDataGeneration('weather')).toBe(1);
      expect(getDataGeneration('calendar')).toBe(0);
    });

    it('stops habit audio first and applies the language after settings load', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      expect(mockCalls[0]).toBe('stopHabitSound');
      expect(mockCalls.indexOf('settingsLoad')).toBeLessThan(
        mockCalls.indexOf('applyAppLanguage'),
      );
    });

    it('runs the whole sequence in one fixed order', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      expect(mockCalls).toEqual([
        'stopHabitSound',
        'cancelCalendarReminders',
        'clearCachedForecast',
        'elementLoad',
        'preloadConfiguredHabitSounds',
        'foodLoad',
        'todoLoad',
        'settingsLoad',
        'applyAppLanguage',
        'calendarLoad',
      ]);
    });

    it('leaves the weather widget unrefreshed while it is disabled', async () => {
      await reloadStoresAfterImport({ fullReplace: true });

      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('force-refreshes weather when the widget is enabled', async () => {
      useSettingsStore.setState({ weatherWidgetEnabled: true });
      // The settings reload reads an empty settings table, so keep the flag on.
      const load = useSettingsStore.getState().load;
      useSettingsStore.setState({
        load: async () => {
          await load();
          useSettingsStore.setState({ weatherWidgetEnabled: true });
        },
      });

      await reloadStoresAfterImport({ fullReplace: true });

      expect(mockRefresh).toHaveBeenCalledWith({ force: true });
      useSettingsStore.setState({ load, weatherWidgetEnabled: false });
    });
  });

  describe('partial clear: calendar only', () => {
    it('wipes and reloads calendar and leaves every other mirror alone', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ calendar: true }) });

      expect(useCalendarStore.getState().calendars).toEqual([]);
      expect(mockCalls).toContain('cancelCalendarReminders');
      expect(mockCalls).toContain('calendarLoad');

      expect(useEventStore.getState().dailyTotals).toEqual({ 'counter-1': 5 });
      expect(useWeatherStore.getState().forecast).toBe(staleForecast);
      expect(useFoodStore.getState().items).toHaveLength(1);
      expect(useTodoStore.getState().todos).toEqual([staleTodo]);
      // Settings are only reloaded for preferences/weather/full.
      expect(mockCalls).not.toContain('settingsLoad');
      expect(mockCalls).not.toContain('foodLoad');
      expect(mockCalls).not.toContain('todoLoad');
    });

    it('bumps only the protocol generation', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ calendar: true }) });

      expect(getDataGeneration('protocol')).toBe(1);
      expect(getDataGeneration('catalog')).toBe(0);
      expect(getDataGeneration('todos')).toBe(0);
      expect(getDataGeneration('journal')).toBe(0);
      expect(getDataGeneration('weather')).toBe(0);
      expect(getDataGeneration('calendar')).toBe(0);
    });
  });

  describe('partial clear: weather only', () => {
    it('clears weather and reloads settings, leaving calendar and activity', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ weather: true }) });

      expect(useWeatherStore.getState().forecast).toBeNull();
      expect(mockCalls).toContain('clearCachedForecast');
      expect(mockCalls).toContain('settingsLoad');
      expect(getDataGeneration('weather')).toBe(1);

      expect(useCalendarStore.getState().calendars).toHaveLength(1);
      expect(mockCalls).not.toContain('cancelCalendarReminders');
      expect(mockCalls).not.toContain('calendarLoad');
      expect(useEventStore.getState().habitStreaks).toEqual({ 'habit-1': 3 });
      expect(useFoodStore.getState().items).toHaveLength(1);
    });
  });

  describe('partial clear: preferences only', () => {
    it('also clears weather, because the saved location lived in preferences', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ preferences: true }) });

      expect(useWeatherStore.getState().forecast).toBeNull();
      expect(mockCalls).toContain('clearCachedForecast');
      expect(mockCalls).toContain('settingsLoad');
      expect(getDataGeneration('weather')).toBe(1);

      expect(useEventStore.getState().dailyTotals).toEqual({ 'counter-1': 5 });
      expect(useCalendarStore.getState().calendars).toHaveLength(1);
    });
  });

  describe('partial clear: definitions only', () => {
    it('wipes activity mirrors, refetches food, and keeps open todos', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ definitions: true }) });

      const event = useEventStore.getState();
      expect(event.dailyTotals).toEqual({});
      expect(event.habitDoneToday).toEqual({});
      expect(event.habitStreaks).toEqual({});
      expect(event.habitFailureStreaks).toEqual({});
      expect(event.counterStreaks).toEqual({});
      expect(event.activeTimerSessions).toEqual({});
      expect(event.dayStateReady).toBe(true);
      expect(event.counterTotalsReady).toBe(true);

      expect(useFoodStore.getState().items).toEqual([]);
      expect(useFoodStore.getState().weekStart).toBe(
        startOfWeekDate(currentAppCalendarDate()),
      );
      expect(useTodoStore.getState().todos).toEqual([openTodo]);

      expect(useCalendarStore.getState().calendars).toHaveLength(1);
      expect(useWeatherStore.getState().forecast).toBe(staleForecast);
      expect(mockCalls).not.toContain('settingsLoad');
    });

    it('bumps the protocol, catalog, todo and journal generations', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ definitions: true }) });

      expect(getDataGeneration('protocol')).toBe(1);
      expect(getDataGeneration('catalog')).toBe(1);
      expect(getDataGeneration('todos')).toBe(1);
      expect(getDataGeneration('journal')).toBe(1);
      expect(getDataGeneration('weather')).toBe(0);
    });
  });

  describe('partial clear: activity history only', () => {
    it('wipes the same mirrors as a definitions clear', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ activityHistory: true }) });

      expect(useEventStore.getState().dailyTotals).toEqual({});
      expect(useFoodStore.getState().items).toEqual([]);
      expect(useTodoStore.getState().todos).toEqual([openTodo]);
      expect(getDataGeneration('catalog')).toBe(1);
      expect(useCalendarStore.getState().calendars).toHaveLength(1);
      expect(useWeatherStore.getState().forecast).toBe(staleForecast);
    });
  });

  describe('always, whatever was cleared', () => {
    it('reloads elements and applies the app language', async () => {
      await reloadStoresAfterImport({ cleared: cleared({ weather: true }) });

      expect(mockCalls).toContain('elementLoad');
      expect(mockCalls).toContain('applyAppLanguage');
      expect(useElementStore.getState().isLoaded).toBe(true);
    });
  });
});
