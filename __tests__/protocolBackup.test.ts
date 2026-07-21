/* eslint-disable import/first -- jest mocks must load before module imports */
import { getDatabase } from '../src/db/client';
import { readAppSettings, writeAppSettings } from '../src/db/appSettingsBackup';
import { clearAllAppData } from '../src/db/resetAppData';
import { importProtocolBundle, serializeBundle } from '../src/db/export';
import * as elementRepo from '../src/db/repositories/elementRepository';
import * as settingsRepo from '../src/db/repositories/settingsRepository';
import {
  createProtocolBundle,
  HabitConfigSchema,
  parseProtocolBundle,
  PROTOCOL_VERSION,
} from '../src/protocol';

jest.mock('../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../src/db/repositories/elementRepository', () => ({
  getAllElements: jest.fn(),
  insertElement: jest.fn(),
}));

jest.mock('../src/db/repositories/dashboardRepository', () => ({
  getDashboardItems: jest.fn(),
  insertDashboardItem: jest.fn(),
}));

jest.mock('../src/db/repositories/eventRepository', () => ({
  getAllEvents: jest.fn(),
  insertEvent: jest.fn(),
}));

jest.mock('../src/db/repositories/dayNoteRepository', () => ({
  getAllNotes: jest.fn(async () => []),
  insertNote: jest.fn(async () => undefined),
  deleteAllNotes: jest.fn(async () => undefined),
  deleteNotesBeforeDate: jest.fn(async () => undefined),
}));

jest.mock('../src/db/repositories/settingsRepository', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));

jest.mock('../src/db/repositories/calendarRepository', () => ({
  getAllCalendars: jest.fn(async () => []),
  getAllEvents: jest.fn(async () => []),
  getAllReminders: jest.fn(async () => []),
  getAllOccurrenceClears: jest.fn(async () => []),
  clearCalendarData: jest.fn(async () => undefined),
  importCalendarData: jest.fn(async () => undefined),
  ensureDefaultCalendar: jest.fn(async () => ({
    id: '550e8400-e29b-41d4-a716-446655440201',
    name: 'Personal',
    color: '#3D7EA6',
    source: 'local',
  })),
}));

jest.mock('../src/db/repositories/weatherRepository', () => ({
  clearWeatherDaily: jest.fn(async () => undefined),
}));

const habitElement = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  kind: 'habit' as const,
  name: 'Meditate',
  config: HabitConfigSchema.parse({
    timeSlot: 'anytime',
    trackingMode: 'boolean',
  }),
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt: null,
};

describe('protocol backup settings', () => {
  const db = {
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    runAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDatabase as jest.Mock).mockResolvedValue(db);
  });

  it('includes validated app settings in export bundles', () => {
    const bundle = createProtocolBundle({
      elements: [habitElement],
      dashboard: [],
      events: [],
      settings: {
        themeMode: 'cartoon',
        habitRemindersEnabled: true,
      },
    });

    expect(parseProtocolBundle(bundle)).toEqual(bundle);
    expect(JSON.parse(serializeBundle(bundle)).settings).toEqual({
      themeMode: 'cartoon',
      habitRemindersEnabled: true,
    });
  });

  it('strips unknown legacy settings keys', () => {
    const legacy = {
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [habitElement],
      dashboard: [],
      events: [],
      settings: {
        themeMode: 'light' as const,
        dailyViewFilter: 'remaining',
        dailyArrangeMode: 'order',
      },
    };

    expect(parseProtocolBundle(legacy).settings).toEqual({ themeMode: 'light' });
  });

  it('accepts older backups without settings', () => {
    const legacy = {
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [habitElement],
      dashboard: [],
      events: [],
    };

    expect(parseProtocolBundle(legacy).settings).toBeUndefined();
  });

  it('reads theme and reminder settings from SQLite', async () => {
    (settingsRepo.getSetting as jest.Mock).mockImplementation(
      async (_db: unknown, key: string) => {
        if (key === 'theme_mode') return 'dark';
        if (key === 'habit_reminders_enabled') return 'true';
        return null;
      },
    );

    await expect(readAppSettings(db as never)).resolves.toEqual({
      themeMode: 'dark',
      habitRemindersEnabled: true,
    });
  });

  it('writes settings during import', async () => {
    await writeAppSettings(db as never, {
      themeMode: 'light',
      habitRemindersEnabled: false,
    });

    expect(settingsRepo.setSetting).toHaveBeenCalledWith(db, 'theme_mode', 'light');
    expect(settingsRepo.setSetting).toHaveBeenCalledWith(
      db,
      'habit_reminders_enabled',
      'false',
    );
  });

  it('imports settings together with protocol data', async () => {
    const bundle = createProtocolBundle({
      elements: [habitElement],
      dashboard: [],
      events: [],
      settings: {
        themeMode: 'dark',
        habitRemindersEnabled: true,
      },
    });

    await importProtocolBundle(bundle);

    expect(settingsRepo.setSetting).toHaveBeenCalledWith(db, 'theme_mode', 'dark');
    expect(settingsRepo.setSetting).toHaveBeenCalledWith(
      db,
      'habit_reminders_enabled',
      'true',
    );
    expect(elementRepo.insertElement).toHaveBeenCalledWith(db, habitElement);
  });

  it('imports day notes with protocol data', async () => {
    const dayNoteRepo = jest.requireMock('../src/db/repositories/dayNoteRepository') as {
      insertNote: jest.Mock;
    };
    const note = {
      id: '550e8400-e29b-41d4-a716-446655440030',
      elementId: habitElement.id,
      date: '2025-01-02',
      body: 'Felt focused',
      updatedAt: '2025-01-02T18:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
    };
    const bundle = createProtocolBundle({
      elements: [habitElement],
      dashboard: [],
      events: [],
      dayNotes: [note],
    });

    await importProtocolBundle(bundle);

    expect(dayNoteRepo.insertNote).toHaveBeenCalledWith(db, note);
  });

  it('clears protocol tables, calendar, and app settings', async () => {
    await clearAllAppData();

    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM day_notes');
    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM events');
    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM dashboard_items');
    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM elements');
    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM app_settings');
  });

  it('clears preferences before importing a backup', async () => {
    const bundle = createProtocolBundle({
      elements: [],
      dashboard: [],
      events: [],
      settings: { themeMode: 'light' },
    });

    await importProtocolBundle(bundle);

    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM app_settings');
    expect(settingsRepo.setSetting).toHaveBeenCalledWith(db, 'theme_mode', 'light');
  });
});
