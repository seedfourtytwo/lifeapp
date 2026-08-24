import { i18n } from '../src/i18n';
import { exportBackupAlertKeys } from '../src/utils/protocolBackupResult';

describe('exportBackupAlertKeys', () => {
  it('confirms a direct save (web download)', () => {
    expect(exportBackupAlertKeys('saved')).toEqual({
      titleKey: 'settings:data.backupSavedTitle',
      bodyKey: 'settings:data.backupSavedBody',
    });
  });

  it('confirms a share-sheet export so the native path is never silent', () => {
    expect(exportBackupAlertKeys('shared')).toEqual({
      titleKey: 'settings:data.backupSharedTitle',
      bodyKey: 'settings:data.backupSharedBody',
    });
  });

  it('resolves every key it returns in the English catalog', () => {
    for (const result of ['saved', 'shared'] as const) {
      const { titleKey, bodyKey } = exportBackupAlertKeys(result);
      expect(i18n.t(titleKey)).not.toBe(titleKey);
      expect(i18n.t(bodyKey)).not.toBe(bodyKey);
    }
  });
});
