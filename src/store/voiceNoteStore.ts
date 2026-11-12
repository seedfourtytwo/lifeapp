import { create } from 'zustand';
import { lifeCore } from '../core/lifeCore';
import { deleteVoiceNote, keepVoiceNote, voiceNoteExists } from '../voiceNote/voiceNoteFile';

interface VoiceNoteState {
  /** A note is on the phone. */
  exists: boolean;
  /** The native core is playing it (from here, the urge screen or the widget). */
  playing: boolean;
  refresh: () => Promise<void>;
  /** Keep a finished recording as the note. */
  keep: (recordingUri: string) => Promise<void>;
  remove: () => Promise<void>;
  /** Plays it through the native core, which ducks a running habit timer's sound under it. */
  play: () => Promise<void>;
  stop: () => Promise<void>;
}

/** The one voice note: a file in the app's private storage, not a SQLite row. */
export const useVoiceNoteStore = create<VoiceNoteState>((set) => ({
  exists: false,
  playing: false,
  refresh: async () => set({ exists: await voiceNoteExists() }),
  keep: async (recordingUri) => {
    await lifeCore.stopNote();
    await keepVoiceNote(recordingUri);
    set({ exists: await voiceNoteExists() });
  },
  remove: async () => {
    await lifeCore.stopNote();
    await deleteVoiceNote();
    set({ exists: false });
  },
  play: async () => {
    await lifeCore.playNote();
  },
  stop: () => lifeCore.stopNote(),
}));

lifeCore.addNoteListener((playing) => useVoiceNoteStore.setState({ playing }));
