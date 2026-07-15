import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { clearAllAppData } from '../db/resetAppData';
import {
  exportBackupToFile,
  importBackupFromFile,
  isImportBackupAvailable,
} from '../utils/protocolBackup';
import { reloadStoresAfterImport } from '../utils/reloadStoresAfterImport';

export function useProtocolBackup() {
  const [busy, setBusy] = useState(false);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await exportBackupToFile();
      if (result === 'saved') {
        Alert.alert('Backup saved', 'Your JSON backup was saved to the folder you chose.');
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
      Alert.alert('Import complete', 'Your habits, counters, history, and preferences were restored.');
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
        'Backup import needs a fresh dev build. Run: eas build --platform android --profile development',
      );
      return;
    }

    Alert.alert(
      'Import backup?',
      'This replaces all habits, counters, history, and preferences on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', style: 'destructive', onPress: () => void runImport() },
      ],
    );
  }, [runImport]);

  const runClearAllData = useCallback(async () => {
    setBusy(true);
    try {
      await clearAllAppData();
      await reloadStoresAfterImport();
      Alert.alert('Data deleted', 'All habits, counters, history, and preferences were removed.');
    } catch (error) {
      Alert.alert(
        'Delete failed',
        error instanceof Error ? error.message : 'Could not delete local data.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleClearAllData = useCallback(() => {
    Alert.alert(
      'Delete all data?',
      'This removes every habit, counter, event, and app preference on this device. Export a backup first if you might need it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => void runClearAllData() },
      ],
    );
  }, [runClearAllData]);

  return {
    busy,
    importAvailable: isImportBackupAvailable(),
    handleExport,
    handleImport,
    handleClearAllData,
  };
}
