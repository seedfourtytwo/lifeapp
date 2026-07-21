import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
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
  const [busy, setBusy] = useState(false);
  const [clearSheetVisible, setClearSheetVisible] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await exportBackupToFile();
      if (result === 'saved') {
        Alert.alert('Backup saved', 'Your JSON backup was saved to the folder you chose.');
      } else {
        Alert.alert('Backup ready', 'Share or save the JSON file from the share sheet.');
      }
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Could not export your data.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const runImport = useCallback(async () => {
    setBusy(true);
    try {
      const imported = await importBackupFromFile();
      if (!imported) return;

      await reloadStoresAfterImport();
      Alert.alert('Import complete', 'Your habits, counters, history, day notes, and preferences were restored.');
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof Error ? error.message : 'Could not import that backup file.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleImport = useCallback(() => {
    if (!isImportBackupAvailable()) {
      Alert.alert(
        'Rebuild required',
        'Backup import needs a dev client with document picker. Run: npx expo run:android (local) or eas build --platform android --profile development',
      );
      return;
    }

    Alert.alert(
      'Import backup?',
      'This replaces all habits, counters, history, day notes, and preferences on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', style: 'destructive', onPress: () => void runImport() },
      ],
    );
  }, [runImport]);

  const runClearData = useCallback(async (options: ClearAppDataOptions) => {
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
        'Data cleared',
        lines.length > 0 ? lines.map((line) => `• ${line}`).join('\n') : 'Selected data was removed.',
      );
    } catch (error) {
      Alert.alert(
        'Clear failed',
        error instanceof Error ? error.message : 'Could not clear local data.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleClearConfirm = useCallback(
    (options: ClearAppDataOptions) => {
      const lines = describeClearPlan(options);
      const body =
        (lines.length > 0 ? `${lines.map((line) => `• ${line}`).join('\n')}\n\n` : '') +
        'This cannot be undone.';

      if (options.definitions) {
        Alert.alert('Remove habits & counters?', body, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove everything selected',
            style: 'destructive',
            onPress: () => void runClearData(options),
          },
        ]);
        return;
      }

      Alert.alert('Clear selected data?', body, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => void runClearData(options),
        },
      ]);
    },
    [runClearData],
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
