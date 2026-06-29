import { create } from 'zustand';
import type { SoundAsset } from '../protocol/sound';
import { getDatabase } from '../db/client';
import * as soundLibraryRepo from '../db/repositories/soundLibraryRepository';
import { newId } from '../utils/id';

function fileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'audio';
}

function labelFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return base.replace(/[-_]+/g, ' ').trim() || 'Sound track';
}

async function getSoundsDirectory(): Promise<string> {
  const FileSystem = await import('expo-file-system/legacy');
  return `${FileSystem.documentDirectory ?? ''}sounds/`;
}

interface SoundLibraryState {
  sounds: SoundAsset[];
  isLoaded: boolean;
  load: () => Promise<void>;
  addFromFile: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  getById: (id: string | undefined) => SoundAsset | undefined;
}

export const useSoundLibraryStore = create<SoundLibraryState>((set, get) => ({
  sounds: [],
  isLoaded: false,

  load: async () => {
    const db = await getDatabase();
    const sounds = await soundLibraryRepo.getSoundLibrary(db);
    set({ sounds, isLoaded: true });
  },

  addFromFile: async () => {
    const DocumentPicker = await import('expo-document-picker');
    const FileSystem = await import('expo-file-system/legacy');

    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const file = result.assets[0];
    const id = newId();
    const ext = fileExtension(file.name);
    if (!FileSystem.documentDirectory) {
      throw new Error('Local storage is not available on this device');
    }

    const soundsDir = await getSoundsDirectory();
    await FileSystem.makeDirectoryAsync(soundsDir, { intermediates: true });
    const destUri = `${soundsDir}${id}.${ext}`;
    await FileSystem.copyAsync({ from: file.uri, to: destUri });

    const asset: SoundAsset = {
      id,
      label: labelFromFilename(file.name),
      source: 'file',
      uri: destUri,
    };

    const db = await getDatabase();
    const sounds = await soundLibraryRepo.addSoundAsset(db, asset);
    set({ sounds });
  },

  remove: async (id) => {
    const existing = get().sounds.find((sound) => sound.id === id);
    const db = await getDatabase();
    const sounds = await soundLibraryRepo.removeSoundAsset(db, id);
    set({ sounds });

    if (existing?.source === 'file') {
      try {
        const FileSystem = await import('expo-file-system/legacy');
        const soundsDir = await getSoundsDirectory();
        if (existing.uri.startsWith(soundsDir)) {
          await FileSystem.deleteAsync(existing.uri, { idempotent: true });
        }
      } catch {
        // File may already be gone.
      }
    }
  },

  getById: (id) => {
    if (!id) return undefined;
    return get().sounds.find((sound) => sound.id === id);
  },
}));
