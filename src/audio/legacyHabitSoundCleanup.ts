/** Delete legacy on-device sound files from older app versions. */
export async function deleteLegacyHabitSoundFile(uri: string | undefined): Promise<void> {
  if (!uri?.trim()) return;

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const docDir = FileSystem.documentDirectory ?? '';
    const managedPrefixes = [`${docDir}habit-sounds/`, `${docDir}sounds/`];
    if (!managedPrefixes.some((prefix) => uri.startsWith(prefix))) return;
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // File may already be gone.
  }
}
