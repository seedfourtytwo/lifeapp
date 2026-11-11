import {
  AUTO_BACKUPS_KEPT,
  autoBackupFileName,
  autoBackupsToPrune,
  isAutoBackupFileName,
  type BackupFile,
  type BackupTarget,
} from '../src/backup/backupTarget';
import {
  runAutoBackup,
  TARGET_TIMEOUT_MS,
  type AutoBackupDeps,
  type TargetStatus,
} from '../src/backup/autoBackup';

/** The daily backup runner against fake targets and a fake clock. */

class FakeTarget implements BackupTarget {
  readonly files: string[] = [];
  available = true;
  failWrite: Error | null = null;
  pruned: number[] = [];

  constructor(readonly name: string) {}

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async write(file: BackupFile): Promise<void> {
    if (this.failWrite) throw this.failWrite;
    this.files.push(file.name);
  }

  async list(): Promise<string[]> {
    return [...this.files];
  }

  async prune(keep: number): Promise<void> {
    this.pruned.push(keep);
  }
}

function harness(targets: BackupTarget[], start: Date) {
  let now = start;
  const statuses: Record<string, TargetStatus> = {};
  const makeFile = jest.fn(async (at: Date): Promise<BackupFile> => ({
    name: autoBackupFileName(at),
    contents: '{"protocolVersion":1}',
  }));
  const deps: AutoBackupDeps = {
    targets: () => targets,
    now: () => now,
    makeFile,
    readStatuses: async () => ({ ...statuses }),
    recordStatus: async (name, status) => {
      statuses[name] = status;
    },
  };
  return {
    deps,
    statuses,
    makeFile,
    setNow: (next: Date) => {
      now = next;
    },
  };
}

const MORNING = new Date(2026, 10, 11, 8, 0);
const EVENING = new Date(2026, 10, 11, 21, 0);
const NEXT_MORNING = new Date(2026, 10, 12, 7, 30);

describe('runAutoBackup', () => {
  it('writes one backup a day, on the first foreground of that day', async () => {
    const folder = new FakeTarget('phoneFolder');
    const { deps, statuses, setNow } = harness([folder], MORNING);

    await runAutoBackup(deps);
    setNow(EVENING);
    await runAutoBackup(deps);
    expect(folder.files).toEqual([autoBackupFileName(MORNING)]);
    expect(statuses.phoneFolder).toEqual({ lastSuccessAt: MORNING.toISOString(), lastError: null });

    setNow(NEXT_MORNING);
    await runAutoBackup(deps);
    expect(folder.files).toEqual([autoBackupFileName(MORNING), autoBackupFileName(NEXT_MORNING)]);
  });

  it('keeps the last fourteen after each backup', async () => {
    const folder = new FakeTarget('phoneFolder');
    const { deps } = harness([folder], MORNING);
    await runAutoBackup(deps);
    expect(AUTO_BACKUPS_KEPT).toBe(14);
    expect(folder.pruned).toEqual([14]);
  });

  it('records a failure and tries again at the next foreground', async () => {
    const folder = new FakeTarget('phoneFolder');
    folder.failWrite = new Error('Location isn\'t writable.');
    const { deps, statuses, setNow } = harness([folder], MORNING);

    await runAutoBackup(deps);
    expect(statuses.phoneFolder).toEqual({
      lastSuccessAt: null,
      lastError: { at: MORNING.toISOString(), message: 'Location isn\'t writable.' },
    });

    folder.failWrite = null;
    setNow(EVENING);
    await runAutoBackup(deps);
    expect(folder.files).toEqual([autoBackupFileName(EVENING)]);
    expect(statuses.phoneFolder).toEqual({ lastSuccessAt: EVENING.toISOString(), lastError: null });
  });

  it('keeps the last success when a later day fails', async () => {
    const folder = new FakeTarget('phoneFolder');
    const { deps, statuses, setNow } = harness([folder], MORNING);
    await runAutoBackup(deps);

    folder.available = false;
    setNow(NEXT_MORNING);
    await runAutoBackup(deps);

    expect(statuses.phoneFolder).toEqual({
      lastSuccessAt: MORNING.toISOString(),
      lastError: { at: NEXT_MORNING.toISOString(), message: 'unavailable' },
    });
  });

  it('never lets one failing target stop another', async () => {
    const broken = new FakeTarget('server');
    broken.failWrite = new Error('offline');
    const folder = new FakeTarget('phoneFolder');
    const { deps, statuses, makeFile } = harness([broken, folder], MORNING);

    await expect(runAutoBackup(deps)).resolves.toBeUndefined();

    expect(folder.files).toHaveLength(1);
    expect(statuses.phoneFolder?.lastSuccessAt).toBe(MORNING.toISOString());
    expect(statuses.server?.lastError?.message).toBe('offline');
    expect(makeFile).toHaveBeenCalledTimes(1);
  });

  it('gives up on a target that hangs, without holding up the others', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      const hung = new FakeTarget('server');
      hung.write = () => new Promise<void>(() => undefined);
      const folder = new FakeTarget('phoneFolder');
      const { deps, statuses } = harness([hung, folder], MORNING);

      const run = runAutoBackup(deps);
      // Let the export and the writes start before the clock jumps past the limit.
      for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve));
      await jest.advanceTimersByTimeAsync(TARGET_TIMEOUT_MS);
      await run;

      expect(folder.files).toHaveLength(1);
      expect(statuses.server?.lastError?.message).toBe('timed out');
      // The next foreground runs again: nothing is left stuck in flight.
      hung.write = FakeTarget.prototype.write;
      await runAutoBackup(deps);
      expect(hung.files).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('only writes to the targets that are due', async () => {
    const folder = new FakeTarget('phoneFolder');
    const server = new FakeTarget('server');
    server.failWrite = new Error('offline');
    const { deps, setNow } = harness([folder, server], MORNING);
    await runAutoBackup(deps);

    server.failWrite = null;
    setNow(EVENING);
    await runAutoBackup(deps);

    expect(folder.files).toHaveLength(1);
    expect(server.files).toHaveLength(1);
  });

  it('records the error on every due target when the export itself fails', async () => {
    const folder = new FakeTarget('phoneFolder');
    const { deps, statuses, makeFile } = harness([folder], MORNING);
    makeFile.mockRejectedValueOnce(new Error('database is locked'));

    await runAutoBackup(deps);

    expect(statuses.phoneFolder?.lastError?.message).toBe('database is locked');
    expect(folder.files).toEqual([]);
  });

  it('does nothing with no target configured', async () => {
    const { deps, makeFile } = harness([], MORNING);
    await runAutoBackup(deps);
    expect(makeFile).not.toHaveBeenCalled();
  });

  it('runs once when two foregrounds overlap', async () => {
    const folder = new FakeTarget('phoneFolder');
    const { deps } = harness([folder], MORNING);
    await Promise.all([runAutoBackup(deps), runAutoBackup(deps)]);
    expect(folder.files).toHaveLength(1);
  });
});

describe('backup files', () => {
  it('are told apart from manual exports so pruning never touches those', () => {
    expect(autoBackupFileName(MORNING)).toBe('life-dashboard-auto-backup-2026-11-11-080000.json');
    expect(isAutoBackupFileName('life-dashboard-auto-backup-2026-11-11-080000.json')).toBe(true);
    expect(isAutoBackupFileName('life-dashboard-backup-2026-11-11-080000.json')).toBe(false);
  });

  it('prune the oldest automatic backups beyond the ones kept', () => {
    const days = Array.from({ length: 16 }, (_, i) => autoBackupFileName(new Date(2026, 9, i + 1, 8)));
    const names = ['life-dashboard-backup-2026-01-01-080000.json', ...[...days].reverse()];
    expect(autoBackupsToPrune(names, 14)).toEqual([days[0], days[1]]);
    expect(autoBackupsToPrune(days.slice(0, 3), 14)).toEqual([]);
  });
});
