import {
  exportProtocolBundle,
  importProtocolBundle,
  serializeBundle,
} from '../db/export';
import { protocolBackupFileName } from './protocolBackupFileName';

export type ExportBackupResult = 'saved' | 'shared';

export function isImportBackupAvailable(): boolean {
  return true;
}

export async function exportBackupToFile(): Promise<ExportBackupResult> {
  const bundle = await exportProtocolBundle();
  const json = serializeBundle(bundle);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = protocolBackupFileName();
  anchor.click();
  URL.revokeObjectURL(url);
  return 'saved';
}

export async function importBackupFromFile(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = () => {
      void (async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(false);
          return;
        }

        try {
          const json = await file.text();
          const raw: unknown = JSON.parse(json);
          await importProtocolBundle(raw);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      })();
    };

    input.click();
  });
}
