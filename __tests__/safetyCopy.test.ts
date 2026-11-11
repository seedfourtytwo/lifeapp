/* eslint-disable import/first -- jest mocks must load before module imports */
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/data/files/SQLite',
  openDatabaseAsync: jest.fn(),
  backupDatabaseAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(async () => undefined),
}));

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { runMigrations } from '../src/db/migrations';
import {
  SAFETY_COPIES_KEPT,
  safetyCopiesToPrune,
  safetyCopyFileName,
  takeSafetyCopy,
} from '../src/db/safetyCopy';

type Bind = null | number | string;
function wrap(raw: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => { raw.exec(sql); },
    runAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: Bind[]) => raw.prepare(sql).get(...p) ?? null,
  } as unknown as SQLiteDatabase;
}

function dbAtVersion(from: number): DatabaseSync {
  const raw = new DatabaseSync(':memory:');
  raw.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
  raw.prepare('INSERT INTO schema_version (version) VALUES (?)').run(from);
  raw.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  return raw;
}

function tableNames(raw: DatabaseSync): string[] {
  return (raw.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[])
    .map((row) => row.name);
}

describe('before migrations', () => {
  it('takes the copy once, before anything touches an old database', async () => {
    const raw = dbAtVersion(20);
    const seen: string[][] = [];
    await runMigrations(wrap(raw), {
      beforeUpgrade: async () => {
        seen.push(tableNames(raw));
      },
    });
    expect(seen).toEqual([['app_settings', 'schema_version']]);
    raw.close();
  });

  it('does not run the migration when the copy fails', async () => {
    const raw = dbAtVersion(20);
    await expect(
      runMigrations(wrap(raw), {
        beforeUpgrade: async () => {
          throw new Error('disk full');
        },
      }),
    ).rejects.toThrow('disk full');
    expect(tableNames(raw)).toEqual(['app_settings', 'schema_version']);
    expect(raw.prepare('SELECT version FROM schema_version').get()).toEqual({ version: 20 });
    raw.close();
  });

  it('takes no copy on a fresh install or a database already current', async () => {
    const raw = new DatabaseSync(':memory:');
    const beforeUpgrade = jest.fn(async () => undefined);
    await runMigrations(wrap(raw), { beforeUpgrade });
    await runMigrations(wrap(raw), { beforeUpgrade });
    expect(beforeUpgrade).not.toHaveBeenCalled();
    raw.close();
  });
});

describe('copy files', () => {
  it('names copies so they sort oldest first, whatever the reason', () => {
    const names = [
      safetyCopyFileName('import', new Date('2026-11-11T09:00:00.000Z')),
      safetyCopyFileName('migration', new Date('2026-03-29T01:30:00.000Z')),
      safetyCopyFileName('clear', new Date('2026-11-11T09:00:00.500Z')),
    ];
    expect([...names].sort()).toEqual([names[1], names[0], names[2]]);
    expect(names[1]).toBe('20260329T013000000Z-migration.db');
  });

  it('prunes the oldest copies beyond the ones kept, with their side files', () => {
    const copies = Array.from({ length: 7 }, (_, day) =>
      safetyCopyFileName('migration', new Date(Date.UTC(2026, 0, day + 1))),
    );
    const listing = [...copies, `${copies[0]}-wal`, 'unrelated.txt'];
    expect(safetyCopiesToPrune(listing, 5).sort()).toEqual(
      [copies[0], `${copies[0]}-wal`, copies[1]].sort(),
    );
    expect(safetyCopiesToPrune(copies.slice(0, 3), 5)).toEqual([]);
  });
});

describe('takeSafetyCopy', () => {
  const source = {} as SQLiteDatabase;
  const copyDb = { closeAsync: jest.fn(async () => undefined) };
  const at = new Date('2026-11-11T08:15:00.123Z');

  beforeEach(() => {
    jest.clearAllMocks();
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(copyDb);
    (SQLite.backupDatabaseAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
  });

  it('backs the live database up into a new file in the app\'s own storage, then closes it', async () => {
    await takeSafetyCopy(source, 'import', at);
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith(
      '20261111T081500123Z-import.db',
      undefined,
      '/data/files/SQLite/safety-copies',
    );
    expect(SQLite.backupDatabaseAsync).toHaveBeenCalledWith({
      sourceDatabase: source,
      destDatabase: copyDb,
    });
    expect(copyDb.closeAsync).toHaveBeenCalled();
  });

  it('keeps the last few copies', async () => {
    const older = Array.from({ length: SAFETY_COPIES_KEPT }, (_, day) =>
      safetyCopyFileName('migration', new Date(Date.UTC(2026, 0, day + 1))),
    );
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
      ...older,
      '20261111T081500123Z-import.db',
    ]);
    await takeSafetyCopy(source, 'import', at);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      `file:///data/files/SQLite/safety-copies/${older[0]}`,
      { idempotent: true },
    );
  });

  it('fails loudly and removes the half-written file when the backup fails', async () => {
    (SQLite.backupDatabaseAsync as jest.Mock).mockRejectedValue(new Error('SQLITE_BUSY'));
    await expect(takeSafetyCopy(source, 'migration', at)).rejects.toThrow('SQLITE_BUSY');
    expect(copyDb.closeAsync).toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///data/files/SQLite/safety-copies/20261111T081500123Z-migration.db',
      { idempotent: true },
    );
  });
});
