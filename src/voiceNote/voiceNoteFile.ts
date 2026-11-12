import * as FileSystem from 'expo-file-system/legacy';
import { ensureWidgetDirectory, widgetDirectory } from '../widget/widgetFiles';

/**
 * The one voice note: `files/widget/voice-note.m4a`, the app's private
 * storage, beside the widget's files, where the native core plays it from
 * (`docs/widget-contract.md`). Never in an export or import.
 */
export const VOICE_NOTE_FILE = 'voice-note.m4a';
/** A note is short: recording stops here by itself. */
export const VOICE_NOTE_MAX_SECONDS = 60;

/** Null where there is no private files directory (web): no note there. */
export function voiceNoteUri(): string | null {
  const directory = widgetDirectory();
  return directory ? `${directory}${VOICE_NOTE_FILE}` : null;
}

export async function voiceNoteExists(): Promise<boolean> {
  const uri = voiceNoteUri();
  return uri !== null && (await FileSystem.getInfoAsync(uri)).exists;
}

/** Keep a finished recording as the note, in place of any earlier one. */
export async function keepVoiceNote(recordingUri: string): Promise<void> {
  const directory = widgetDirectory();
  const uri = voiceNoteUri();
  if (!directory || !uri) return;
  await ensureWidgetDirectory(directory);
  await FileSystem.deleteAsync(uri, { idempotent: true });
  await FileSystem.moveAsync({ from: recordingUri, to: uri });
}

export async function deleteVoiceNote(): Promise<void> {
  const uri = voiceNoteUri();
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}
