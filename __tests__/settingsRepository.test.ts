import { getSettings } from '../src/db/repositories/settingsRepository';
import type { SQLiteDatabase } from 'expo-sqlite';

describe('getSettings', () => {
  it('returns null for every key when none are stored', async () => {
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([]),
    } as unknown as SQLiteDatabase;

    const map = await getSettings(db, ['a', 'b']);
    expect(map.get('a')).toBeNull();
    expect(map.get('b')).toBeNull();
    expect(db.getAllAsync).toHaveBeenCalledWith(
      'SELECT key, value FROM app_settings WHERE key IN (?, ?)',
      'a',
      'b',
    );
  });

  it('fills found values and leaves missing keys null', async () => {
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([{ key: 'theme_mode', value: 'dark' }]),
    } as unknown as SQLiteDatabase;

    const map = await getSettings(db, ['theme_mode', 'app_language']);
    expect(map.get('theme_mode')).toBe('dark');
    expect(map.get('app_language')).toBeNull();
  });

  it('short-circuits an empty key list', async () => {
    const db = {
      getAllAsync: jest.fn(),
    } as unknown as SQLiteDatabase;

    const map = await getSettings(db, []);
    expect(map.size).toBe(0);
    expect(db.getAllAsync).not.toHaveBeenCalled();
  });
});
