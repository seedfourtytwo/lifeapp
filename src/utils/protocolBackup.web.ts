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

    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      resolve(value);
    };

    const onWindowFocus = () => {
      // File dialog cancel does not fire onchange; resolve after focus returns.
      window.setTimeout(() => {
        if (!input.files?.length) {
          settle(false);
        }
      }, 300);
    };

    input.onchange = () => {
      void (async () => {
        const file = input.files?.[0];
        if (!file) {
          settle(false);
          return;
        }

        try {
          const json = await file.text();
          const raw: unknown = JSON.parse(json);
          await importProtocolBundle(raw);
          settle(true);
        } catch (error) {
          settled = true;
          window.removeEventListener('focus', onWindowFocus);
          reject(error);
        }
      })();
    };

    window.addEventListener('focus', onWindowFocus);
    input.click();
  });
}
