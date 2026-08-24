import { protocolBackupFileName } from '../src/utils/protocolBackupFileName';

describe('protocolBackupFileName', () => {
  it('includes local date and time so Proton Drive can accept a second save', () => {
    const at = new Date(2026, 7, 14, 19, 33, 5);
    expect(protocolBackupFileName(at)).toBe('life-dashboard-backup-2026-08-14-193305.json');
  });
});
