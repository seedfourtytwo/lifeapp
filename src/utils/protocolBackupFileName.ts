function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Unique per save so destinations that refuse overwrite (Proton Drive)
 * accept a second export the same day.
 */
export function protocolBackupFileName(at = new Date()): string {
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `life-dashboard-backup-${date}-${time}.json`;
}
