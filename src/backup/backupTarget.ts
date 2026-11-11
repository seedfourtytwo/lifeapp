/**
 * Somewhere a daily backup can go: a folder on the phone today, the home
 * server later. Each target owns its own files; the runner only asks it to
 * take one more and to keep the last few.
 */

export interface BackupFile {
  name: string;
  /** The same JSON the manual export writes. */
  contents: string;
}

export interface BackupTarget {
  /** Stable key for the target's recorded status. */
  readonly name: string;
  /** False when it cannot take a file right now (folder gone, server unreachable). */
  isAvailable(): Promise<boolean>;
  write(file: BackupFile): Promise<void>;
  /** The automatic backup files the target holds — never anything else in it. */
  list(): Promise<string[]>;
  /** Delete all but the newest `keep` automatic backups. */
  prune(keep: number): Promise<void>;
}

/** Two weeks of days: enough to step back past a bad week without filling the folder. */
export const AUTO_BACKUPS_KEPT = 14;

const AUTO_PREFIX = 'life-dashboard-auto-backup-';
const AUTO_NAME = /^life-dashboard-auto-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Local time, like the manual export's name, but with its own prefix: pruning
 * must only ever delete files the runner made, never an export kept by hand.
 */
export function autoBackupFileName(at: Date): string {
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${AUTO_PREFIX}${date}-${time}.json`;
}

export function isAutoBackupFileName(name: string): boolean {
  return AUTO_NAME.test(name);
}

/** The automatic backups older than the newest `keep`. Names sort by time. */
export function autoBackupsToPrune(names: readonly string[], keep: number): string[] {
  const backups = names.filter(isAutoBackupFileName).sort();
  return backups.slice(0, Math.max(0, backups.length - keep));
}
