import { i18n } from '../src/i18n';
import { exportBackupAlertKeys } from '../src/utils/protocolBackupResult';

describe('exportBackupAlertKeys', () => {
  it('confirms a direct save (web download)', () => {
    expect(exportBackupAlertKeys({ destination: 'saved', skippedRows: 0 })).toEqual({
      titleKey: 'settings:data.backupSavedTitle',
      bodyKey: 'settings:data.backupSavedBody',
      skippedRowsKey: null,
    });
  });

  it('confirms a share-sheet export so the native path is never silent', () => {
    expect(exportBackupAlertKeys({ destination: 'shared', skippedRows: 0 })).toEqual({
      titleKey: 'settings:data.backupSharedTitle',
      bodyKey: 'settings:data.backupSharedBody',
      skippedRowsKey: null,
    });
  });

  it('says so when rows were left out, instead of looking complete', () => {
    const keys = exportBackupAlertKeys({ destination: 'shared', skippedRows: 3 });
    expect(keys.skippedRowsKey).toBe('settings:data.backupSkippedRows');
    expect(i18n.t('settings:data.backupSkippedRows', { count: 3 })).toContain('3');
    expect(i18n.t('settings:data.backupSkippedRows', { count: 1 })).toContain('1');
  });

  it('resolves every key it returns in the English catalog', () => {
    for (const destination of ['saved', 'shared'] as const) {
      const { titleKey, bodyKey, skippedRowsKey } = exportBackupAlertKeys({
        destination,
        skippedRows: 1,
      });
      expect(i18n.t(titleKey)).not.toBe(titleKey);
      expect(i18n.t(bodyKey)).not.toBe(bodyKey);
      expect(skippedRowsKey).not.toBeNull();
      expect(i18n.t(skippedRowsKey ?? '', { count: 1 })).not.toBe(skippedRowsKey);
    }
  });
});
