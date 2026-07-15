import { NativeModules, Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
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

/** Avoid loading expo-document-picker when the native module is missing (old dev client). */
export function isImportBackupAvailable(): boolean {
  return NativeModules.ExpoDocumentPicker != null;
}

async function getDocumentPicker(): Promise<DocumentPickerModule> {
  if (!isImportBackupAvailable()) {
    throw new Error(
      'Import needs a dev client rebuild. Run: eas build --platform android --profile development',
    );
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
    throw new Error('Could not access app storage for export');
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
    title: 'Export Life Dashboard backup',
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
