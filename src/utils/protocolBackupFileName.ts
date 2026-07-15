export function protocolBackupFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `life-dashboard-backup-${stamp}.json`;
}

export function protocolBackupFileBaseName(): string {
  return protocolBackupFileName().replace(/\.json$/, '');
}
