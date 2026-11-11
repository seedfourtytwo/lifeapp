import { toDateString } from '../protocol/event';
import { AUTO_BACKUPS_KEPT, type BackupFile, type BackupTarget } from './backupTarget';

/**
 * The daily backup. When the app comes to the front and a target's last
 * successful backup is from an earlier day, one export goes to every such
 * target. A target that fails records why and is tried again at the next
 * foreground; it never stops another target, and nothing here throws.
 *
 * The export takes the database write lock, so a backup waits for an import,
 * a clear or a write in progress and never reads one half done.
 */

export interface TargetStatus {
  lastSuccessAt: string | null;
  lastError: { at: string; message: string } | null;
}

export interface AutoBackupDeps {
  /** The targets configured right now; read at each run. */
  targets: () => readonly BackupTarget[];
  now: () => Date;
  makeFile: (at: Date) => Promise<BackupFile>;
  readStatuses: () => Promise<Record<string, TargetStatus>>;
  recordStatus: (name: string, status: TargetStatus) => Promise<void>;
}

/** Recorded for a target that said it could not take a file. */
export const TARGET_UNAVAILABLE = 'unavailable';

/** A target that has not finished by then counts as failed, so it cannot hold the run open. */
export const TARGET_TIMEOUT_MS = 120_000;

function withTimeout(work: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), TARGET_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isDue(status: TargetStatus | undefined, today: string): boolean {
  if (!status?.lastSuccessAt) return true;
  return toDateString(new Date(status.lastSuccessAt)) < today;
}

async function backUpTo(target: BackupTarget, file: BackupFile): Promise<void> {
  if (!(await target.isAvailable())) throw new Error(TARGET_UNAVAILABLE);
  await target.write(file);
  try {
    await target.prune(AUTO_BACKUPS_KEPT);
  } catch (error) {
    // The backup itself landed; an old one left behind is pruned next time.
    console.warn(`Could not prune old backups on ${target.name}`, error);
  }
}

async function run(deps: AutoBackupDeps): Promise<void> {
  const at = deps.now();
  const today = toDateString(at);
  const statuses = await deps.readStatuses();
  const due = deps.targets().filter((target) => isDue(statuses[target.name], today));
  if (due.length === 0) return;

  const failed = (target: BackupTarget, error: unknown) =>
    deps.recordStatus(target.name, {
      lastSuccessAt: statuses[target.name]?.lastSuccessAt ?? null,
      lastError: { at: at.toISOString(), message: messageOf(error) },
    });

  let file: BackupFile;
  try {
    file = await deps.makeFile(at);
  } catch (error) {
    for (const target of due) await failed(target, error);
    return;
  }

  // Side by side, so a slow or hung target holds up no other.
  await Promise.all(
    due.map(async (target) => {
      try {
        await withTimeout(backUpTo(target, file));
        await deps.recordStatus(target.name, { lastSuccessAt: at.toISOString(), lastError: null });
      } catch (error) {
        await failed(target, error);
      }
    }),
  );
}

let inFlight: Promise<void> | null = null;

/** Joins a run already in progress rather than starting a second. Never rejects. */
export function runAutoBackup(deps: AutoBackupDeps): Promise<void> {
  inFlight ??= run(deps)
    .catch((error) => {
      console.warn('Automatic backup failed', error);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
