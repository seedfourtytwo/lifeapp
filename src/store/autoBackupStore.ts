import * as FileSystem from 'expo-file-system/legacy';
import { z } from 'zod';
import { create } from 'zustand';
import type { TargetStatus } from '../backup/autoBackup';

/**
 * The daily backup's own settings and results: the folder Chris picked and
 * each target's last success and last error.
 *
 * Kept in a small file of the app's own rather than in SQLite: an import or
 * a clear of preferences replaces app_settings, and must not switch the
 * backup off or erase the record of the last one. The file goes with an
 * uninstall, as does the folder permission it describes.
 */

const TargetStatusSchema = z.object({
  lastSuccessAt: z.string().datetime().nullable(),
  lastError: z.object({ at: z.string().datetime(), message: z.string() }).nullable(),
});

const StateSchema = z.object({
  phoneFolderUri: z.string().nullable().default(null),
  statuses: z.record(TargetStatusSchema).default({}),
});

type PersistedState = z.infer<typeof StateSchema>;

const EMPTY: PersistedState = { phoneFolderUri: null, statuses: {} };

function stateFileUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}auto-backup.json` : null;
}

async function readState(): Promise<PersistedState> {
  const uri = stateFileUri();
  if (!uri || !(await FileSystem.getInfoAsync(uri)).exists) return EMPTY;
  try {
    return StateSchema.parse(JSON.parse(await FileSystem.readAsStringAsync(uri)));
  } catch (error) {
    console.warn('Unreadable backup settings; starting over', error);
    return EMPTY;
  }
}

let writeChain: Promise<void> = Promise.resolve();

/** One write at a time, each of the latest state, so two changes cannot interleave. */
function writeState(state: PersistedState): Promise<void> {
  const uri = stateFileUri();
  if (!uri) return Promise.resolve();
  writeChain = writeChain
    .catch(() => undefined)
    .then(() => FileSystem.writeAsStringAsync(uri, JSON.stringify(state)));
  return writeChain;
}

interface AutoBackupStoreState extends PersistedState {
  loaded: boolean;
  load: () => Promise<void>;
  setPhoneFolder: (uri: string) => Promise<void>;
  recordStatus: (target: string, status: TargetStatus) => Promise<void>;
}

export const useAutoBackupStore = create<AutoBackupStoreState>((set, get) => {
  const persist = () =>
    writeState({ phoneFolderUri: get().phoneFolderUri, statuses: get().statuses });

  return {
    ...EMPTY,
    loaded: false,

    load: async () => {
      set({ ...(await readState()), loaded: true });
    },

    setPhoneFolder: async (uri) => {
      // A new folder has no history: its first backup is due at once.
      const { phoneFolder: _previous, ...others } = get().statuses;
      set({ phoneFolderUri: uri, statuses: others });
      await persist();
    },

    recordStatus: async (target, status) => {
      set({ statuses: { ...get().statuses, [target]: status } });
      await persist();
    },
  };
});
