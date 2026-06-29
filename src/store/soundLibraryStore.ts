import { create } from 'zustand';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { SoundAsset } from '../protocol/sound';
import { getDatabase } from '../db/client';
import * as soundLibraryRepo from '../db/repositories/soundLibraryRepository';
import { newId } from '../utils/id';

const SOUNDS_DIR = `${FileSystem.documentDirectory ?? ''}sounds/`;

function fileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'audio';
}

function labelFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return base.replace(/[-_]+/g, ' ').trim() || 'Sound track';
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
    await FileSystem.makeDirectoryAsync(SOUNDS_DIR, { intermediates: true });
    const destUri = `${SOUNDS_DIR}${id}.${ext}`;
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

    if (existing?.source === 'file' && existing.uri.startsWith(SOUNDS_DIR)) {
      try {
        await FileSystem.deleteAsync(existing.uri, { idempotent: true });
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
