import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
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
import { reloadStoresAfterImport } from '../utils/reloadStoresAfterImport';

export function useProtocolBackup() {
  const { t } = useTranslation(['settings', 'common']);
  const [busy, setBusy] = useState(false);
  const [clearSheetVisible, setClearSheetVisible] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await exportBackupToFile();
      if (result === 'cancelled') return;
      if (result === 'saved') {
        Alert.alert(t('settings:data.backupSavedTitle'), t('settings:data.backupSavedBody'));
      }
    } catch (error) {
      Alert.alert(
        t('settings:data.exportFailedTitle'),
        error instanceof Error ? error.message : t('settings:data.exportFailedBodyFallback'),
      );
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
      Alert.alert(t('settings:data.importCompleteTitle'), t('settings:data.importCompleteBody'));
    } catch (error) {
      Alert.alert(
        t('settings:data.importFailedTitle'),
        error instanceof Error ? error.message : t('settings:data.importFailedBodyFallback'),
      );
    } finally {
      setBusy(false);
    }
  }, [t]);

  const handleImport = useCallback(() => {
    if (!isImportBackupAvailable()) {
      Alert.alert(
        t('common:alerts.rebuildRequiredTitle'),
        t('settings:data.importRebuildRequiredBody'),
      );
      return;
    }

    Alert.alert(
      t('settings:data.importConfirmTitle'),
      t('settings:data.importConfirmBody'),
      [
        { text: t('common:actions.cancel'), style: 'cancel' },
        {
          text: t('settings:data.importConfirmAction'),
          style: 'destructive',
          onPress: () => void runImport(),
        },
      ],
    );
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
        Alert.alert(
          t('settings:data.clearedTitle'),
          lines.length > 0
            ? lines.map((line) => `• ${line}`).join('\n')
            : t('settings:data.clearedBodyFallback'),
        );
      } catch (error) {
        Alert.alert(
          t('settings:data.clearFailedTitle'),
          error instanceof Error ? error.message : t('settings:data.clearFailedBodyFallback'),
        );
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

      if (options.definitions) {
        Alert.alert(t('settings:data.clearConfirmDefinitionsTitle'), body, [
          { text: t('common:actions.cancel'), style: 'cancel' },
          {
            text: t('settings:data.clearConfirmDefinitionsAction'),
            style: 'destructive',
            onPress: () => void runClearData(options),
          },
        ]);
        return;
      }

      Alert.alert(t('settings:data.clearConfirmTitle'), body, [
        { text: t('common:actions.cancel'), style: 'cancel' },
        {
          text: t('settings:data.clearConfirmAction'),
          style: 'destructive',
          onPress: () => void runClearData(options),
        },
      ]);
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
