import { requireOptionalNativeModule } from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { i18n } from '../i18n';
import {
  exportProtocolBundle,
  importProtocolBundle,
  serializeBundle,
} from '../db/export';
import { protocolBackupFileName } from './protocolBackupFileName';
import type { ExportBackupResult } from './protocolBackupResult';

type DocumentPickerModule = typeof import('expo-document-picker');

export type { ExportBackupResult };

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

/**
 * Same path as note share: a real file + system share sheet.
 * `text/plain` is required so Android shows the app chooser (Proton Drive,
 * Files, …) instead of the “Use this folder” picker.
 */
async function shareBackupFile(json: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(i18n.t('settings:data.couldNotAccessStorage'));
  }

  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error(i18n.t('settings:data.couldNotAccessStorage'));
  }

  const path = `${directory}${protocolBackupFileName()}`;
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const fileUrl = path.startsWith('file:') ? path : `file://${path}`;
  await Sharing.shareAsync(fileUrl, {
    mimeType: 'text/plain',
    dialogTitle: i18n.t('settings:data.exportShareTitle'),
    UTI: 'public.plain-text',
  });
}

export async function exportBackupToFile(): Promise<ExportBackupResult> {
  const bundle = await exportProtocolBundle();
  const json = serializeBundle(bundle);
  await shareBackupFile(json);
  return 'shared';
}

export async function importBackupFromFile(): Promise<boolean> {
  const DocumentPicker = await getDocumentPicker();
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
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
