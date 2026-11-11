import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { SettingsRow } from '../../components/settings';
import { backupStatusLine } from '../../backup/backupStatusLine';
import { runDailyBackup } from '../../backup/dailyBackup';
import {
  folderDisplayName,
  isPhoneStorageFolder,
  PHONE_FOLDER_TARGET,
} from '../../backup/phoneFolderTarget';
import { getDateLocale } from '../../i18n';
import { useAutoBackupStore } from '../../store/autoBackupStore';

function formatWhen(when: Date): string {
  return when.toLocaleString(getDateLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The folder the daily backup goes to, and how the last one went. */
export default function BackupFolderRow() {
  const { t } = useTranslation('settings');
  const folderUri = useAutoBackupStore((s) => s.phoneFolderUri);
  const status = useAutoBackupStore((s) => s.statuses[PHONE_FOLDER_TARGET]);
  const loaded = useAutoBackupStore((s) => s.loaded);
  const load = useAutoBackupStore((s) => s.load);
  const setPhoneFolder = useAutoBackupStore((s) => s.setPhoneFolder);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [load, loaded]);

  const choose = useCallback(async () => {
    setBusy(true);
    try {
      const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!result.granted) return;
      if (!isPhoneStorageFolder(result.directoryUri)) {
        Alert.alert(t('data.autoBackupNotOnPhoneTitle'), t('data.autoBackupNotOnPhoneBody'));
        return;
      }
      await setPhoneFolder(result.directoryUri);
      await runDailyBackup();
    } catch (error) {
      Alert.alert(
        t('data.autoBackupFolderFailedTitle'),
        error instanceof Error ? error.message : t('data.exportFailedBodyFallback'),
      );
    } finally {
      setBusy(false);
    }
  }, [setPhoneFolder, t]);

  if (Platform.OS !== 'android') return null;

  const line = backupStatusLine(folderUri, status);
  const description =
    'when' in line
      ? t(line.key, { when: formatWhen(line.when), ...('reason' in line ? { reason: line.reason } : {}) })
      : t(line.key);

  return (
    <SettingsRow
      icon="folder-sync-outline"
      title={t('data.autoBackupTitle')}
      description={description}
      trailingValue={folderUri ? folderDisplayName(folderUri) : undefined}
      chevron
      busy={busy}
      onPress={busy ? undefined : () => void choose()}
    />
  );
}
