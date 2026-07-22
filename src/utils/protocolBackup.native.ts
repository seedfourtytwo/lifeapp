import { Platform, Share } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';
import { i18n } from '../i18n';
import {
  exportProtocolBundle,
  importProtocolBundle,
  serializeBundle,
} from '../db/export';
import {
  protocolBackupFileBaseName,
  protocolBackupFileName,
} from './protocolBackupFileName';

type DocumentPickerModule = typeof import('expo-document-picker');

export type ExportBackupResult = 'saved' | 'shared';

/** Expo Modules (new architecture) — not present on React Native NativeModules. */
export function isImportBackupAvailable(): boolean {
  return requireOptionalNativeModule('ExpoDocumentPicker') != null;
}

async function getDocumentPicker(): Promise<DocumentPickerModule> {
  if (!isImportBackupAvailable()) {
    throw new Error(i18n.t('settings:data.importRebuildRequiredBody'));
  }

  return import('expo-document-picker');
}

async function saveBackupToAndroidFolder(json: string): Promise<boolean> {
  const { StorageAccessFramework } = FileSystem;
  const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) {
    return false;
  }

  const fileUri = await StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    protocolBackupFileBaseName(),
    'application/json',
  );
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return true;
}

async function shareBackupFile(json: string): Promise<void> {
  const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!directory) {
    throw new Error(i18n.t('settings:data.couldNotAccessStorage'));
  }

  const path = `${directory}${protocolBackupFileName()}`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const shareUrl =
    Platform.OS === 'android'
      ? await FileSystem.getContentUriAsync(path)
      : path;

  await Share.share({
    title: i18n.t('settings:data.exportShareTitle'),
    url: shareUrl,
  });
}

export async function exportBackupToFile(): Promise<ExportBackupResult> {
  const bundle = await exportProtocolBundle();
  const json = serializeBundle(bundle);

  if (Platform.OS === 'android') {
    const saved = await saveBackupToAndroidFolder(json);
    if (saved) {
      return 'saved';
    }
  }

  await shareBackupFile(json);
  return 'shared';
}

export async function importBackupFromFile(): Promise<boolean> {
  const DocumentPicker = await getDocumentPicker();
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return false;
  }

  const json = await FileSystem.readAsStringAsync(result.assets[0].uri);
  const raw: unknown = JSON.parse(json);
  await importProtocolBundle(raw);
  return true;
}
