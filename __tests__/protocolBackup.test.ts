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

jest.mock('../src/db/repositories/settingsRepository', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
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
        dailyViewFilter: 'remaining',
        habitRemindersEnabled: true,
      },
    });

    expect(parseProtocolBundle(bundle)).toEqual(bundle);
    expect(JSON.parse(serializeBundle(bundle)).settings).toEqual({
      themeMode: 'cartoon',
      dailyViewFilter: 'remaining',
      habitRemindersEnabled: true,
    });
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

  it('reads theme, filter, and reminder settings from SQLite', async () => {
    (settingsRepo.getSetting as jest.Mock).mockImplementation(
      async (_db: unknown, key: string) => {
        if (key === 'theme_mode') return 'dark';
        if (key === 'daily_view_filter') return 'starting_soon';
        if (key === 'habit_reminders_enabled') return 'true';
        return null;
      },
    );

    await expect(readAppSettings(db as never)).resolves.toEqual({
      themeMode: 'dark',
      dailyViewFilter: 'remaining',
      habitRemindersEnabled: true,
    });
  });

  it('writes settings during import', async () => {
    await writeAppSettings(db as never, {
      themeMode: 'light',
      dailyViewFilter: 'all',
      habitRemindersEnabled: false,
    });

    expect(settingsRepo.setSetting).toHaveBeenCalledWith(db, 'theme_mode', 'light');
    expect(settingsRepo.setSetting).toHaveBeenCalledWith(db, 'daily_view_filter', 'all');
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

  it('clears protocol tables and app settings', async () => {
    await clearAllAppData();

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
