import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clearAppData,
  clearOptionsAreEmpty,
  describeClearPlan,
  type ClearAppDataOptions,
} from '../db/resetAppData';
import {
  exportBackupToFile,
  importBackupFromFile,
  isImportBackupAvailable,
} from '../utils/protocolBackup';
import { exportBackupAlertKeys } from '../utils/protocolBackupResult';
import { reloadStoresAfterImport } from '../utils/reloadStoresAfterImport';
import { confirm, notify } from '../components/sheet/confirm';

export function useProtocolBackup() {
  const { t } = useTranslation(['settings', 'common']);
  const [busy, setBusy] = useState(false);
  const [clearSheetVisible, setClearSheetVisible] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const { titleKey, bodyKey } = exportBackupAlertKeys(await exportBackupToFile());
      void notify({ title: t(titleKey), message: t(bodyKey) });
    } catch (error) {
      void notify({
        title: t('settings:data.exportFailedTitle'),
        message: error instanceof Error ? error.message : t('settings:data.exportFailedBodyFallback'),
      });
    } finally {
      setBusy(false);
    }
  }, [t]);

  const runImport = useCallback(async () => {
    setBusy(true);
    try {
      const imported = await importBackupFromFile();
      if (!imported) return;

      await reloadStoresAfterImport();
      void notify({
        title: t('settings:data.importCompleteTitle'),
        message: t('settings:data.importCompleteBody'),
      });
    } catch (error) {
      void notify({
        title: t('settings:data.importFailedTitle'),
        message: error instanceof Error ? error.message : t('settings:data.importFailedBodyFallback'),
      });
    } finally {
      setBusy(false);
    }
  }, [t]);

  const handleImport = useCallback(() => {
    if (!isImportBackupAvailable()) {
      void notify({
        title: t('common:alerts.rebuildRequiredTitle'),
        message: t('settings:data.importRebuildRequiredBody'),
      });
      return;
    }

    void confirm({
      title: t('settings:data.importConfirmTitle'),
      message: t('settings:data.importConfirmBody'),
      confirmLabel: t('settings:data.importConfirmAction'),
      destructive: true,
    }).then((confirmed) => {
      if (confirmed) void runImport();
    });
  }, [runImport, t]);

  const runClearData = useCallback(
    async (options: ClearAppDataOptions) => {
      if (clearOptionsAreEmpty(options)) return;

      setBusy(true);
      try {
        await clearAppData(options);
        await reloadStoresAfterImport({
          cleared: {
            calendar: options.calendar,
            weather: options.weather,
            preferences: options.preferences,
            definitions: options.definitions,
            activityHistory: options.activityHistory,
          },
        });
        setClearSheetVisible(false);
        const lines = describeClearPlan(options);
        void notify({
          title: t('settings:data.clearedTitle'),
          message: lines.length > 0
            ? lines.map((line) => `• ${line}`).join('\n')
            : t('settings:data.clearedBodyFallback'),
        });
      } catch (error) {
        void notify({
          title: t('settings:data.clearFailedTitle'),
          message: error instanceof Error ? error.message : t('settings:data.clearFailedBodyFallback'),
        });
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const handleClearConfirm = useCallback(
    (options: ClearAppDataOptions) => {
      const lines = describeClearPlan(options);
      const body =
        (lines.length > 0 ? `${lines.map((line) => `• ${line}`).join('\n')}\n\n` : '') +
        t('settings:data.clearConfirmSuffix');

      void confirm({
        title: options.definitions
          ? t('settings:data.clearConfirmDefinitionsTitle')
          : t('settings:data.clearConfirmTitle'),
        message: body,
        confirmLabel: options.definitions
          ? t('settings:data.clearConfirmDefinitionsAction')
          : t('settings:data.clearConfirmAction'),
        destructive: true,
      }).then((confirmed) => {
        if (confirmed) void runClearData(options);
      });
    },
    [runClearData, t],
  );

  const openClearSheet = useCallback(() => {
    setClearSheetVisible(true);
  }, []);

  const dismissClearSheet = useCallback(() => {
    if (busy) return;
    setClearSheetVisible(false);
  }, [busy]);

  return {
    busy,
    importAvailable: isImportBackupAvailable(),
    clearSheetVisible,
    handleExport,
    handleImport,
    openClearSheet,
    dismissClearSheet,
    handleClearConfirm,
  };
}
